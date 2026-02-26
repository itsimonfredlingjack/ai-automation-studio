use crate::commands::automation::sync_automation_manager;
use crate::db;
use crate::error::AppError;
use crate::models::automation_schedule::{AutomationSchedule, AutomationScheduleRun, ScheduleStatus};
use crate::state::AppState;
use chrono::Utc;
use tauri::State;

#[tauri::command]
pub fn list_schedules(state: State<'_, AppState>) -> Result<Vec<AutomationSchedule>, AppError> {
    let conn = state.db.lock().unwrap();
    Ok(db::automation_schedule::list_schedules(&conn)?)
}

#[tauri::command]
pub fn create_schedule(
    state: State<'_, AppState>,
    workflow_id: String,
    cadence: String,
    hourly_interval: Option<i64>,
    weekly_days: Option<Vec<String>>,
    hour: Option<i64>,
    minute: Option<i64>,
) -> Result<AutomationSchedule, AppError> {
    let schedule = {
        let conn = state.db.lock().unwrap();
        db::workflow::load_workflow(&conn, &workflow_id)?
            .ok_or_else(|| AppError::NotFound(workflow_id.clone()))?;
        db::automation_schedule::create_schedule(
            &conn,
            &workflow_id,
            cadence.trim().to_ascii_lowercase().as_str(),
            hourly_interval,
            &weekly_days.unwrap_or_default(),
            hour.unwrap_or(9),
            minute.unwrap_or(0),
        )?
    };
    sync_automation_manager(&state)?;
    Ok(schedule)
}

#[tauri::command]
pub fn toggle_schedule(
    state: State<'_, AppState>,
    id: String,
    status: String,
) -> Result<AutomationSchedule, AppError> {
    let updated = {
        let conn = state.db.lock().unwrap();
        let mut schedule = db::automation_schedule::load_schedule(&conn, &id)?
            .ok_or_else(|| AppError::NotFound(id.clone()))?;
        schedule.status = parse_status(&status)?;
        schedule.updated_at = Utc::now();
        db::automation_schedule::update_schedule(&conn, &schedule)?;
        schedule
    };
    sync_automation_manager(&state)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_schedule(state: State<'_, AppState>, id: String) -> Result<bool, AppError> {
    let deleted = {
        let conn = state.db.lock().unwrap();
        db::automation_schedule::delete_schedule(&conn, &id)?
    };
    sync_automation_manager(&state)?;
    Ok(deleted)
}

#[tauri::command]
pub fn list_schedule_runs(
    state: State<'_, AppState>,
    schedule_id: Option<String>,
    workflow_id: Option<String>,
    limit: Option<i64>,
    cursor: Option<i64>,
) -> Result<Vec<AutomationScheduleRun>, AppError> {
    let conn = state.db.lock().unwrap();
    Ok(db::automation_schedule_run::list_schedule_runs(
        &conn,
        schedule_id.as_deref(),
        workflow_id.as_deref(),
        limit.unwrap_or(30).clamp(1, 200),
        cursor,
    )?)
}

fn parse_status(value: &str) -> Result<ScheduleStatus, AppError> {
    match value {
        "active" => Ok(ScheduleStatus::Active),
        "paused" => Ok(ScheduleStatus::Paused),
        "disabled" => Ok(ScheduleStatus::Disabled),
        _ => Err(AppError::Engine(format!("Invalid schedule status: {}", value))),
    }
}
