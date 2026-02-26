use crate::db;
use crate::error::AppError;
use crate::models::automation::{AutomationRun, AutomationWatch, WatchStatus};
use crate::state::AppState;
use chrono::Utc;
use tauri::State;

const RUNNER_SETTING_KEY: &str = "automation_runner_enabled";

#[tauri::command]
pub fn list_watches(state: State<AppState>) -> Result<Vec<AutomationWatch>, AppError> {
    let conn = state.db.lock().unwrap();
    Ok(db::automation::list_watches(&conn)?)
}

#[tauri::command]
pub fn create_watch(
    state: State<AppState>,
    workflow_id: String,
    watch_path: String,
    recursive: bool,
    file_glob: String,
    debounce_ms: Option<i64>,
    stability_ms: Option<i64>,
) -> Result<AutomationWatch, AppError> {
    let watch = {
        let conn = state.db.lock().unwrap();
        db::workflow::load_workflow(&conn, &workflow_id)?
            .ok_or_else(|| AppError::NotFound(workflow_id.clone()))?;
        db::automation::create_watch(
            &conn,
            &workflow_id,
            &watch_path,
            recursive,
            file_glob.trim(),
            debounce_ms.unwrap_or(1200).max(100),
            stability_ms.unwrap_or(2000).max(200),
        )?
    };
    sync_automation_manager(&state)?;
    Ok(watch)
}

#[tauri::command]
pub fn update_watch(
    state: State<AppState>,
    id: String,
    watch_path: Option<String>,
    recursive: Option<bool>,
    file_glob: Option<String>,
    debounce_ms: Option<i64>,
    stability_ms: Option<i64>,
) -> Result<AutomationWatch, AppError> {
    let updated = {
        let conn = state.db.lock().unwrap();
        let mut watch = db::automation::load_watch(&conn, &id)?
            .ok_or_else(|| AppError::NotFound(id.clone()))?;
        if let Some(path) = watch_path { watch.watch_path = path; }
        if let Some(value) = recursive { watch.recursive = value; }
        if let Some(glob) = file_glob { watch.file_glob = glob; }
        if let Some(value) = debounce_ms { watch.debounce_ms = value.max(100); }
        if let Some(value) = stability_ms { watch.stability_ms = value.max(200); }
        watch.updated_at = Utc::now();
        db::automation::update_watch(&conn, &watch)?;
        watch
    };
    sync_automation_manager(&state)?;
    Ok(updated)
}

#[tauri::command]
pub fn toggle_watch(
    state: State<AppState>,
    id: String,
    status: String,
) -> Result<AutomationWatch, AppError> {
    let updated = {
        let conn = state.db.lock().unwrap();
        let mut watch = db::automation::load_watch(&conn, &id)?
            .ok_or_else(|| AppError::NotFound(id.clone()))?;
        watch.status = parse_status(&status)?;
        watch.updated_at = Utc::now();
        db::automation::update_watch(&conn, &watch)?;
        watch
    };
    sync_automation_manager(&state)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_watch(state: State<AppState>, id: String) -> Result<bool, AppError> {
    let deleted = {
        let conn = state.db.lock().unwrap();
        db::automation::delete_watch(&conn, &id)?
    };
    sync_automation_manager(&state)?;
    Ok(deleted)
}

#[tauri::command]
pub fn list_automation_runs(
    state: State<AppState>,
    watch_id: Option<String>,
    workflow_id: Option<String>,
    limit: Option<i64>,
    cursor: Option<i64>,
) -> Result<Vec<AutomationRun>, AppError> {
    let conn = state.db.lock().unwrap();
    Ok(db::automation::list_runs(
        &conn,
        watch_id.as_deref(),
        workflow_id.as_deref(),
        limit.unwrap_or(30).clamp(1, 200),
        cursor,
    )?)
}

#[tauri::command]
pub fn get_automation_runner_enabled(state: State<AppState>) -> Result<bool, AppError> {
    let conn = state.db.lock().unwrap();
    Ok(db::settings::get_bool(&conn, RUNNER_SETTING_KEY)?
        .unwrap_or(cfg!(debug_assertions)))
}

#[tauri::command]
pub fn set_automation_runner_enabled(
    state: State<AppState>,
    enabled: bool,
) -> Result<bool, AppError> {
    {
        let conn = state.db.lock().unwrap();
        db::settings::set_bool(&conn, RUNNER_SETTING_KEY, enabled)?;
    }
    let mut manager = state.automations.lock().unwrap();
    manager.set_enabled(enabled).map_err(AppError::Engine)?;
    Ok(enabled)
}

pub fn initialize_automation_runner(state: &State<'_, AppState>) -> Result<(), AppError> {
    let enabled = {
        let conn = state.db.lock().unwrap();
        db::settings::get_bool(&conn, RUNNER_SETTING_KEY)?
            .unwrap_or(cfg!(debug_assertions))
    };
    let mut manager = state.automations.lock().unwrap();
    manager.set_enabled(enabled).map_err(AppError::Engine)
}

pub(crate) fn sync_automation_manager(state: &State<'_, AppState>) -> Result<(), AppError> {
    let enabled = {
        let conn = state.db.lock().unwrap();
        db::settings::get_bool(&conn, RUNNER_SETTING_KEY)?
            .unwrap_or(cfg!(debug_assertions))
    };
    let mut manager = state.automations.lock().unwrap();
    if enabled && manager.is_enabled() {
        manager.sync_from_db().map_err(AppError::Engine)?;
    }
    Ok(())
}

fn parse_status(value: &str) -> Result<WatchStatus, AppError> {
    match value {
        "active" => Ok(WatchStatus::Active),
        "paused" => Ok(WatchStatus::Paused),
        "disabled" => Ok(WatchStatus::Disabled),
        _ => Err(AppError::Engine(format!("Invalid watch status: {}", value))),
    }
}
