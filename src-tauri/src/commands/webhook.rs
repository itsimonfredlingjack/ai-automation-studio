use crate::error::AppError;
use crate::state::AppState;
use crate::webhook::manager::WebhookInfo;
use tauri::State;

#[tauri::command]
pub fn start_webhook(
    state: State<AppState>,
    workflow_id: String,
    port: u16,
) -> Result<String, AppError> {
    let mut manager = state.webhooks.lock().unwrap();
    manager
        .start_listener(workflow_id, port)
        .map_err(AppError::Webhook)
}

#[tauri::command]
pub fn stop_webhook(
    state: State<AppState>,
    workflow_id: String,
) -> Result<(), AppError> {
    let mut manager = state.webhooks.lock().unwrap();
    manager
        .stop_listener(&workflow_id)
        .map_err(AppError::Webhook)
}

#[tauri::command]
pub fn list_webhooks(state: State<AppState>) -> Result<Vec<WebhookInfo>, AppError> {
    let manager = state.webhooks.lock().unwrap();
    Ok(manager.list_active())
}
