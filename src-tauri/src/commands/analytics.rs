use crate::db;
use crate::error::AppError;
use crate::state::AppState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn track_event(
    state: State<AppState>,
    event_name: String,
    properties: Option<Value>,
) -> Result<(), AppError> {
    let conn = state.db.lock().unwrap();
    let payload = properties.unwrap_or_else(|| serde_json::json!({}));
    db::analytics::track_event(&conn, &event_name, &payload)?;
    Ok(())
}
