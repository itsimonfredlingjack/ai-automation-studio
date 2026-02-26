use crate::automation::schedule_clock::next_run_at;
use crate::db;
use crate::engine::DagEngine;
use crate::models::automation_schedule::{AutomationSchedule, AutomationScheduleRun, ScheduleStatus};
use chrono::Utc;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{oneshot, Semaphore};
use uuid::Uuid;

pub fn spawn_schedule_task(
    db_path: PathBuf,
    global_semaphore: Arc<Semaphore>,
) -> oneshot::Sender<()> {
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = run_schedule_loop(db_path, global_semaphore, shutdown_rx).await {
            log::error!("automation schedule loop failed: {}", error);
        }
    });
    shutdown_tx
}

async fn run_schedule_loop(
    db_path: PathBuf,
    global_semaphore: Arc<Semaphore>,
    mut shutdown_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let mut failure_streaks = HashMap::<String, u8>::new();

    loop {
        tokio::select! {
            _ = &mut shutdown_rx => break,
            _ = tokio::time::sleep(Duration::from_secs(5)) => {
                let due = load_due_schedules(&db_path)?;
                for schedule in due {
                    let success = execute_scheduled_run(
                        &db_path,
                        &schedule,
                        global_semaphore.clone(),
                    ).await?;
                    if success {
                        failure_streaks.remove(&schedule.id);
                        continue;
                    }
                    let streak = failure_streaks.entry(schedule.id.clone()).or_insert(0);
                    *streak += 1;
                    if *streak >= 5 {
                        auto_pause_schedule(&db_path, &schedule.id)?;
                        track_analytics(&db_path, "automation_schedule_paused_auto", serde_json::json!({
                            "schedule_id": schedule.id,
                            "workflow_id": schedule.workflow_id
                        }))?;
                    }
                }
            }
        }
    }
    Ok(())
}

fn load_due_schedules(db_path: &PathBuf) -> Result<Vec<AutomationSchedule>, String> {
    let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
    db::automation_schedule::list_due_schedules(&conn, Utc::now(), 8).map_err(|e| e.to_string())
}

async fn execute_scheduled_run(
    db_path: &PathBuf,
    schedule: &AutomationSchedule,
    global_semaphore: Arc<Semaphore>,
) -> Result<bool, String> {
    track_analytics(db_path, "automation_schedule_triggered", serde_json::json!({
        "schedule_id": schedule.id,
        "workflow_id": schedule.workflow_id
    }))?;
    track_analytics(db_path, "automation_run_started", serde_json::json!({
        "trigger": "schedule",
        "schedule_id": schedule.id,
        "workflow_id": schedule.workflow_id
    }))?;

    let started_at = Utc::now();
    let result = execute_with_retry(db_path, &schedule.workflow_id, global_semaphore).await;
    let ended_at = Utc::now();
    let duration_ms = (ended_at - started_at).num_milliseconds().max(0);
    let (status, error_message, success) = match result {
        Ok(()) => ("success".to_string(), None, true),
        Err(error) => ("error".to_string(), Some(error), false),
    };

    let run = AutomationScheduleRun {
        id: Uuid::new_v4().to_string(),
        schedule_id: schedule.id.clone(),
        workflow_id: schedule.workflow_id.clone(),
        trigger_event_id: format!("schedule:{}", Uuid::new_v4()),
        status: status.clone(),
        started_at,
        ended_at,
        duration_ms,
        error_message: error_message.clone(),
    };

    let mut updated = schedule.clone();
    updated.last_run_at = Some(ended_at);
    updated.next_run_at = next_run_at(
        ended_at,
        updated.cadence.as_str(),
        updated.hourly_interval.unwrap_or(1),
        &updated.weekly_days,
        updated.hour,
        updated.minute,
    )?;
    updated.updated_at = ended_at;

    let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
    db::automation_schedule_run::create_schedule_run(&conn, &run)
        .map_err(|e| e.to_string())?;
    db::automation_schedule::update_schedule(&conn, &updated).map_err(|e| e.to_string())?;

    track_analytics(db_path, "automation_run_completed", serde_json::json!({
        "trigger": "schedule",
        "schedule_id": schedule.id,
        "workflow_id": schedule.workflow_id,
        "status": status,
        "duration_ms": duration_ms
    }))?;
    Ok(success)
}

async fn execute_with_retry(
    db_path: &PathBuf,
    workflow_id: &str,
    global_semaphore: Arc<Semaphore>,
) -> Result<(), String> {
    let _permit = global_semaphore.acquire().await.map_err(|e| e.to_string())?;
    for attempt in 0..=1 {
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
        let workflow = db::workflow::load_workflow(&conn, workflow_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Workflow not found: {}", workflow_id))?;
        let engine = DagEngine::new();
        match engine.execute_debug(&workflow, None).await {
            Ok(_) => return Ok(()),
            Err(error) if attempt == 0 => {
                let _ = error;
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            Err(error) => return Err(error),
        }
    }
    Err("schedule execution failed".to_string())
}

fn auto_pause_schedule(db_path: &PathBuf, schedule_id: &str) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
    if let Some(mut schedule) =
        db::automation_schedule::load_schedule(&conn, schedule_id).map_err(|e| e.to_string())?
    {
        schedule.status = ScheduleStatus::Paused;
        schedule.updated_at = Utc::now();
        db::automation_schedule::update_schedule(&conn, &schedule).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn track_analytics(
    db_path: &PathBuf,
    event_name: &str,
    properties: serde_json::Value,
) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
    db::analytics::track_event(&conn, event_name, &properties).map_err(|e| e.to_string())
}
