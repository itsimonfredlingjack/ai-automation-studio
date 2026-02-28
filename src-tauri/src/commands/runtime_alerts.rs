use crate::db;
use crate::error::AppError;
use crate::models::runtime_alert::RuntimeAlert;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn list_runtime_alerts(
    state: State<AppState>,
    limit: Option<i64>,
) -> Result<Vec<RuntimeAlert>, AppError> {
    let conn = state.db.lock().unwrap();
    Ok(db::runtime_alert::list_alerts(&conn, limit.unwrap_or(20).clamp(1, 100))?)
}
