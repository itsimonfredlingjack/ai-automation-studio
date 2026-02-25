use crate::db;
use crate::error::AppError;
use crate::models::workflow::{Workflow, WorkflowMetadata};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn save_workflow(state: State<AppState>, workflow: Workflow) -> Result<(), AppError> {
    let conn = state.db.lock().unwrap();
    db::workflow::save_workflow(&conn, &workflow)?;
    Ok(())
}

#[tauri::command]
pub fn load_workflow(state: State<AppState>, id: String) -> Result<Workflow, AppError> {
    let conn = state.db.lock().unwrap();
    db::workflow::load_workflow(&conn, &id)?.ok_or_else(|| AppError::NotFound(id))
}

#[tauri::command]
pub fn list_workflows(state: State<AppState>) -> Result<Vec<WorkflowMetadata>, AppError> {
    let conn = state.db.lock().unwrap();
    Ok(db::workflow::list_workflows(&conn)?)
}

#[tauri::command]
pub fn delete_workflow(state: State<AppState>, id: String) -> Result<bool, AppError> {
    let conn = state.db.lock().unwrap();
    Ok(db::workflow::delete_workflow(&conn, &id)?)
}

#[tauri::command]
pub async fn execute_workflow(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, AppError> {
    let workflow = {
        let conn = state.db.lock().unwrap();
        db::workflow::load_workflow(&conn, &id)?.ok_or_else(|| AppError::NotFound(id.clone()))?
    };

    let engine = crate::engine::DagEngine::new();
    let results = engine.execute(&workflow).await.map_err(AppError::Engine)?;

    Ok(serde_json::to_value(results).unwrap())
}

#[tauri::command]
pub async fn execute_workflow_debug(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, AppError> {
    let workflow = {
        let conn = state.db.lock().unwrap();
        db::workflow::load_workflow(&conn, &id)?.ok_or_else(|| AppError::NotFound(id.clone()))?
    };

    let engine = crate::engine::DagEngine::new();
    let results = engine
        .execute_debug(&workflow, None)
        .await
        .map_err(AppError::Engine)?;

    Ok(serde_json::to_value(results).unwrap())
}
