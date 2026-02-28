use crate::db;
use crate::engine::{executor::NodeData, ExecutionOutput, DagEngine};
use crate::error::AppError;
use crate::models::automation::{AutomationRun, RunStatus};
use crate::state::AppState;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn run_watch_now(
    state: State<'_, AppState>,
    watch_id: String,
) -> Result<AutomationRun, AppError> {
    let (watch, workflow) = {
        let conn = state.db.lock().unwrap();
        let watch = db::automation::load_watch(&conn, &watch_id)?
            .ok_or_else(|| AppError::NotFound(watch_id.clone()))?;
        let workflow = db::workflow::load_workflow(&conn, &watch.workflow_id)?
            .ok_or_else(|| AppError::NotFound(watch.workflow_id.clone()))?;
        (watch, workflow)
    };

    {
        let conn = state.db.lock().unwrap();
        db::analytics::track_event(
            &conn,
            "automation_run_started",
            &serde_json::json!({
                "watch_id": watch.id,
                "workflow_id": watch.workflow_id,
                "trigger": "manual"
            }),
        )?;
    }

    let started_at = Utc::now();
    let engine = DagEngine::new();
    let execution_result = engine
        .execute_debug_with_globals(
            &workflow,
            None,
            Some(serde_json::json!({
                "trigger_source": "manual",
                "watch_id": watch.id,
                "trigger_event_id": format!("manual:{}", Uuid::new_v4()),
                "analytics_db_path": state.db_path.to_string_lossy().to_string()
            })),
        )
        .await;
    let ended_at = Utc::now();
    let duration_ms = (ended_at - started_at).num_milliseconds().max(0);

    let run = match execution_result {
        Ok(output) => AutomationRun {
            id: Uuid::new_v4().to_string(),
            watch_id: watch.id.clone(),
            workflow_id: watch.workflow_id.clone(),
            trigger_file_path: "[manual-run]".to_string(),
            trigger_event_id: format!("manual:{}", Uuid::new_v4()),
            status: RunStatus::Success,
            started_at,
            ended_at,
            duration_ms,
            result_summary: extract_result_summary(&output),
            error_message: None,
        },
        Err(error) => AutomationRun {
            id: Uuid::new_v4().to_string(),
            watch_id: watch.id.clone(),
            workflow_id: watch.workflow_id.clone(),
            trigger_file_path: "[manual-run]".to_string(),
            trigger_event_id: format!("manual:{}", Uuid::new_v4()),
            status: RunStatus::Error,
            started_at,
            ended_at,
            duration_ms,
            result_summary: None,
            error_message: Some(error),
        },
    };

    {
        let conn = state.db.lock().unwrap();
        db::automation::create_run(&conn, &run)?;
        db::analytics::track_event(
            &conn,
            "automation_run_completed",
            &serde_json::json!({
                "watch_id": run.watch_id,
                "workflow_id": run.workflow_id,
                "status": run.status.as_str(),
                "duration_ms": run.duration_ms,
                "trigger": "manual"
            }),
        )?;
    }

    Ok(run)
}

fn extract_result_summary(output: &ExecutionOutput) -> Option<String> {
    output
        .steps
        .iter()
        .rev()
        .find(|step| step.node_type == "file_sort")
        .and_then(|step| step.outputs.get("output"))
        .and_then(|value| match value {
            NodeData::Text(text) => Some(text.clone()),
            _ => None,
        })
}

#[tauri::command]
pub fn get_last_failed_run(
    state: State<'_, AppState>,
    watch_id: String,
) -> Result<Option<AutomationRun>, AppError> {
    let conn = state.db.lock().unwrap();
    let runs = db::automation::list_runs(&conn, Some(&watch_id), None, 200, None)?;
    Ok(runs
        .into_iter()
        .find(|run| matches!(run.status, RunStatus::Error)))
}
