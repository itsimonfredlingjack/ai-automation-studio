use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

use crate::db;
use crate::engine::executor::NodeData;
use crate::engine::DagEngine;
use crate::models::runtime_alert::{RuntimeAlertSeverity, RuntimeAlertSource};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
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
    terminated_workflows: Arc<Mutex<Vec<String>>>,
}

impl WebhookManager {
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            active: HashMap::new(),
            db_path,
            terminated_workflows: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn start_listener(
        &mut self,
        workflow_id: String,
        port: Option<u16>,
    ) -> Result<WebhookInfo, String> {
        self.process_terminated();
        if self.active.contains_key(&workflow_id) {
            return Err(format!(
                "Webhook already active for workflow {}",
                workflow_id
            ));
        }

        let requested_port = port.unwrap_or(0);
        let listener = match std::net::TcpListener::bind(("127.0.0.1", requested_port)) {
            Ok(listener) => listener,
            Err(error) => {
                let message = format!("Failed to bind port {}: {}", requested_port, error);
                let _ = db::runtime_alert::append_alert(
                    &self.db_path,
                    RuntimeAlertSource::WebhookBind,
                    RuntimeAlertSeverity::Error,
                    Some(workflow_id.as_str()),
                    None,
                    None,
                    message.clone(),
                    serde_json::json!({ "port": requested_port }),
                );
                return Err(message);
            }
        };
        let actual_port = listener
            .local_addr()
            .map(|addr| addr.port())
            .map_err(|error| error.to_string())?;
        listener
            .set_nonblocking(true)
            .map_err(|error| error.to_string())?;
        let listener = tokio::net::TcpListener::from_std(listener)
            .map_err(|error| error.to_string())?;

        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        let db_path = self.db_path.clone();
        let wf_id = workflow_id.clone();
        let terminated_workflows = self.terminated_workflows.clone();

        tauri::async_runtime::spawn(async move {
            if let Err(error) = run_server(db_path.clone(), wf_id.clone(), listener, shutdown_rx).await {
                log::error!("Webhook server error: {}", error);
                let _ = db::runtime_alert::append_alert(
                    &db_path,
                    RuntimeAlertSource::WebhookServer,
                    RuntimeAlertSeverity::Error,
                    Some(wf_id.as_str()),
                    None,
                    None,
                    format!("Webhook server error: {error}"),
                    serde_json::json!({ "port": actual_port }),
                );
            }
            terminated_workflows.lock().unwrap().push(wf_id);
        });

        let info = WebhookInfo {
            workflow_id: workflow_id.clone(),
            port: actual_port,
            url: format!("http://localhost:{}/webhook/{}", actual_port, workflow_id),
        };

        self.active.insert(
            workflow_id.clone(),
            ActiveWebhook {
                workflow_id,
                port: actual_port,
                shutdown_tx: Some(shutdown_tx),
            },
        );

        Ok(info)
    }

    pub fn stop_listener(&mut self, workflow_id: &str) -> Result<(), String> {
        self.process_terminated();
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

    pub fn list_active(&mut self) -> Vec<WebhookInfo> {
        self.process_terminated();
        self.active
            .values()
            .map(|w| WebhookInfo {
                workflow_id: w.workflow_id.clone(),
                port: w.port,
                url: format!("http://localhost:{}/webhook/{}", w.port, w.workflow_id),
            })
            .collect()
    }

    fn process_terminated(&mut self) {
        let mut terminated = self.terminated_workflows.lock().unwrap();
        for workflow_id in terminated.drain(..) {
            self.active.remove(&workflow_id);
        }
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
    listener: tokio::net::TcpListener,
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
    let conn = match db::open_connection(&state.db_path) {
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

#[cfg(test)]
mod tests {
    use super::WebhookManager;
    use crate::db;
    use crate::db::runtime_alert::list_alerts;
    use crate::db::{open_connection, schema::initialize_db};
    use crate::models::workflow::{Position, Workflow, WorkflowEdge, WorkflowNode};
    use crate::models::runtime_alert::RuntimeAlertSource;
    use chrono::Utc;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_db_path(label: &str) -> std::path::PathBuf {
        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!("synapse-{label}-{unique_id}.db"))
    }

    #[tokio::test]
    async fn start_listener_uses_auto_port_and_registers_active_webhook() {
        let db_path = temp_db_path("webhook-auto-port");
        let conn = open_connection(&db_path).expect("db opened");
        initialize_db(&conn).expect("schema initialized");
        drop(conn);

        let mut manager = WebhookManager::new(db_path.clone());
        let info = manager
            .start_listener("workflow-auto".to_string(), None)
            .expect("webhook should start");

        assert_eq!(info.workflow_id, "workflow-auto");
        assert!(info.port > 0);
        assert_eq!(manager.list_active(), vec![info.clone()]);

        manager
            .stop_listener("workflow-auto")
            .expect("webhook should stop");

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    }

    #[tokio::test]
    async fn start_listener_records_runtime_alert_when_port_is_taken() {
        let db_path = temp_db_path("webhook-bind-error");
        let conn = open_connection(&db_path).expect("db opened");
        initialize_db(&conn).expect("schema initialized");
        drop(conn);

        let occupied = std::net::TcpListener::bind("127.0.0.1:0").expect("occupied listener");
        let port = occupied
            .local_addr()
            .expect("occupied addr")
            .port();

        let mut manager = WebhookManager::new(db_path.clone());
        let error = manager
            .start_listener("workflow-bind-error".to_string(), Some(port))
            .expect_err("bind should fail");

        assert!(error.contains("Failed to bind"));
        assert!(manager.list_active().is_empty());

        let conn = open_connection(&db_path).expect("db reopened");
        let alerts = list_alerts(&conn, 10).expect("alerts listed");
        assert_eq!(alerts.len(), 1);
        assert_eq!(alerts[0].source, RuntimeAlertSource::WebhookBind);
        assert_eq!(alerts[0].workflow_id.as_deref(), Some("workflow-bind-error"));
        assert!(alerts[0].message.contains("Failed to bind"));

        drop(occupied);
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    }

    #[tokio::test]
    async fn started_webhook_accepts_http_requests() {
        let db_path = temp_db_path("webhook-http");
        let conn = open_connection(&db_path).expect("db opened");
        initialize_db(&conn).expect("schema initialized");

        let workflow = Workflow {
            id: "workflow-http".to_string(),
            name: "HTTP Webhook".to_string(),
            description: None,
            nodes: vec![
                WorkflowNode {
                    id: "trigger-1".to_string(),
                    node_type: "webhook_trigger".to_string(),
                    position: Position { x: 0.0, y: 0.0 },
                    data: serde_json::json!({}),
                },
                WorkflowNode {
                    id: "respond-1".to_string(),
                    node_type: "webhook_respond".to_string(),
                    position: Position { x: 240.0, y: 0.0 },
                    data: serde_json::json!({
                        "status_code": 200,
                        "content_type": "text/plain"
                    }),
                },
            ],
            edges: vec![WorkflowEdge {
                id: "edge-1".to_string(),
                source: "trigger-1".to_string(),
                target: "respond-1".to_string(),
                source_handle: Some("body".to_string()),
                target_handle: Some("input".to_string()),
            }],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        db::workflow::save_workflow(&conn, &workflow).expect("workflow saved");
        drop(conn);

        let mut manager = WebhookManager::new(db_path.clone());
        let info = manager
            .start_listener("workflow-http".to_string(), None)
            .expect("webhook should start");

        let client = reqwest::Client::new();
        let response = client
            .post(&info.url)
            .body("hello from test")
            .send()
            .await
            .expect("request should succeed");
        let body = response.text().await.expect("response text");

        assert_eq!(body, "hello from test");

        manager
            .stop_listener("workflow-http")
            .expect("webhook should stop");

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    }
}
