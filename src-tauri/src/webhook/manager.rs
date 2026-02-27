use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::oneshot;

use crate::db;
use crate::engine::executor::NodeData;
use crate::engine::DagEngine;

#[derive(Debug, Clone, Serialize)]
pub struct WebhookInfo {
    pub workflow_id: String,
    pub port: u16,
    pub url: String,
}

struct ActiveWebhook {
    workflow_id: String,
    port: u16,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

pub struct WebhookManager {
    active: HashMap<String, ActiveWebhook>,
    db_path: PathBuf,
}

impl WebhookManager {
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            active: HashMap::new(),
            db_path,
        }
    }

    pub fn start_listener(
        &mut self,
        workflow_id: String,
        port: u16,
    ) -> Result<String, String> {
        if self.active.contains_key(&workflow_id) {
            return Err(format!(
                "Webhook already active for workflow {}",
                workflow_id
            ));
        }

        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        let db_path = self.db_path.clone();
        let wf_id = workflow_id.clone();

        tauri::async_runtime::spawn(async move {
            if let Err(e) = run_server(db_path, wf_id, port, shutdown_rx).await {
                log::error!("Webhook server error: {}", e);
            }
        });

        let url = format!("http://localhost:{}/webhook/{}", port, workflow_id);

        self.active.insert(
            workflow_id.clone(),
            ActiveWebhook {
                workflow_id,
                port,
                shutdown_tx: Some(shutdown_tx),
            },
        );

        Ok(url)
    }

    pub fn stop_listener(&mut self, workflow_id: &str) -> Result<(), String> {
        if let Some(mut webhook) = self.active.remove(workflow_id) {
            if let Some(tx) = webhook.shutdown_tx.take() {
                let _ = tx.send(());
            }
            Ok(())
        } else {
            Err(format!(
                "No active webhook for workflow {}",
                workflow_id
            ))
        }
    }

    pub fn list_active(&self) -> Vec<WebhookInfo> {
        self.active
            .values()
            .map(|w| WebhookInfo {
                workflow_id: w.workflow_id.clone(),
                port: w.port,
                url: format!("http://localhost:{}/webhook/{}", w.port, w.workflow_id),
            })
            .collect()
    }
}

#[derive(Clone)]
struct HandlerState {
    db_path: PathBuf,
    workflow_id: String,
}

async fn run_server(
    db_path: PathBuf,
    workflow_id: String,
    port: u16,
    shutdown_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    use axum::{routing::any, Router};

    let state = Arc::new(HandlerState {
        db_path,
        workflow_id,
    });

    let app = Router::new()
        .route("/webhook/{workflow_id}", any(webhook_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(|e| format!("Failed to bind port {}: {}", port, e))?;

    log::info!("Webhook server listening on port {}", port);

    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = shutdown_rx.await;
        })
        .await
        .map_err(|e| format!("Server error: {}", e))
}

async fn webhook_handler(
    axum::extract::State(state): axum::extract::State<Arc<HandlerState>>,
    axum::extract::Path(wf_id): axum::extract::Path<String>,
    method: axum::http::Method,
    headers: axum::http::HeaderMap,
    uri: axum::http::Uri,
    body: String,
) -> axum::response::Response {
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    if wf_id != state.workflow_id {
        return (StatusCode::NOT_FOUND, "Workflow not found").into_response();
    }

    // Open a fresh DB connection for this request
    let conn = match rusqlite::Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    };

    let workflow = match db::workflow::load_workflow(&conn, &state.workflow_id) {
        Ok(Some(w)) => w,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, "Workflow not found").into_response()
        }
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    };

    // Find the webhook_trigger node
    let trigger_id = match workflow
        .nodes
        .iter()
        .find(|n| n.node_type == "webhook_trigger")
    {
        Some(n) => n.id.clone(),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                "No webhook trigger node in workflow",
            )
                .into_response()
        }
    };

    // Build extra inputs for the trigger node
    let headers_json: serde_json::Value = serde_json::json!(
        headers
            .iter()
            .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
            .collect::<HashMap<String, String>>()
    );

    let query_str = uri.query().unwrap_or("");
    let query_params: HashMap<String, String> = query_str
        .split('&')
        .filter(|s| !s.is_empty())
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            Some((
                parts.next()?.to_string(),
                parts.next().unwrap_or("").to_string(),
            ))
        })
        .collect();

    let mut trigger_inputs = HashMap::new();
    trigger_inputs.insert("_webhook_body".to_string(), NodeData::Text(body));
    trigger_inputs.insert(
        "_webhook_headers".to_string(),
        NodeData::Json(headers_json),
    );
    trigger_inputs.insert(
        "_webhook_method".to_string(),
        NodeData::Text(method.to_string()),
    );
    trigger_inputs.insert(
        "_webhook_query".to_string(),
        NodeData::Json(serde_json::json!(query_params)),
    );

    let mut extra_inputs = HashMap::new();
    extra_inputs.insert(trigger_id, trigger_inputs);

    // Execute the workflow
    let engine = DagEngine::new();
    let result = match engine
        .execute_debug_with_globals(
            &workflow,
            Some(extra_inputs),
            Some(serde_json::json!({
                "trigger_source": "webhook",
                "workflow_id": state.workflow_id,
                "webhook_method": method.to_string(),
                "analytics_db_path": state.db_path.to_string_lossy().to_string()
            })),
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, e).into_response()
        }
    };

    // Find the webhook_respond node and build HTTP response
    let respond_node = workflow
        .nodes
        .iter()
        .find(|n| n.node_type == "webhook_respond");

    if let Some(respond) = respond_node {
        let status_code = respond
            .data
            .get("status_code")
            .and_then(|v| v.as_u64())
            .unwrap_or(200) as u16;
        let content_type = respond
            .data
            .get("content_type")
            .and_then(|v| v.as_str())
            .unwrap_or("application/json")
            .to_string();

        let response_body = result
            .steps
            .iter()
            .find(|s| s.node_id == respond.id)
            .and_then(|s| s.outputs.get("output"))
            .map(|data| match data {
                NodeData::Text(t) => t.clone(),
                NodeData::Json(j) => j.to_string(),
                NodeData::Empty => String::new(),
            })
            .unwrap_or_default();

        let status =
            StatusCode::from_u16(status_code).unwrap_or(StatusCode::OK);

        axum::response::Response::builder()
            .status(status)
            .header("content-type", content_type)
            .body(axum::body::Body::from(response_body))
            .unwrap()
    } else {
        // No respond node — return final outputs as JSON
        let output_json =
            serde_json::to_string(&result.final_outputs).unwrap_or_default();
        (
            StatusCode::OK,
            [("content-type", "application/json")],
            output_json,
        )
            .into_response()
    }
}
