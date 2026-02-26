use crate::automation::filters::{is_temporary_file, matches_glob};
use crate::db;
use crate::engine::DagEngine;
use crate::models::automation::{AutomationRun, RunStatus, WatchStatus};
use chrono::Utc;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, oneshot, Semaphore};
use uuid::Uuid;
pub fn spawn_watch_task(
    db_path: PathBuf,
    watch: crate::models::automation::AutomationWatch,
    global_semaphore: Arc<Semaphore>,
) -> oneshot::Sender<()> {
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = run_watch_loop(db_path, watch, global_semaphore, shutdown_rx).await {
            log::error!("automation watch loop failed: {}", error);
        }
    });
    shutdown_tx
}
async fn run_watch_loop(
    db_path: PathBuf,
    watch: crate::models::automation::AutomationWatch,
    global_semaphore: Arc<Semaphore>,
    mut shutdown_rx: oneshot::Receiver<()>,
) -> Result<(), String> {
    let (tx, mut rx) = mpsc::unbounded_channel();
    let mut watcher = RecommendedWatcher::new(
        move |result| {
            let _ = tx.send(result);
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    let mode = if watch.recursive {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };
    watcher
        .watch(Path::new(&watch.watch_path), mode)
        .map_err(|e| e.to_string())?;

    let mut seen = HashMap::<String, Instant>::new();
    let mut inflight = HashSet::<String>::new();
    let mut failures = 0u8;
    loop {
        tokio::select! {
            _ = &mut shutdown_rx => break,
            maybe_event = rx.recv() => {
                let Ok(event) = maybe_event.ok_or_else(|| "watch channel closed".to_string())? else { continue; };
                for path in event.paths {
                    if !should_process_path(&path, &watch.file_glob) {
                        continue;
                    }
                    let key = path.to_string_lossy().to_string();
                    if inflight.contains(&key) {
                        continue;
                    }
                    let now = Instant::now();
                    if let Some(last) = seen.get(&key) {
                        if now.duration_since(*last).as_millis() < watch.debounce_ms as u128 {
                            continue;
                        }
                    }
                    seen.insert(key.clone(), now);
                    if !wait_for_stable_file(&path, watch.stability_ms).await {
                        continue;
                    }
                    inflight.insert(key.clone());
                    let event_id = Uuid::new_v4().to_string();
                    track_analytics(&db_path, "automation_trigger_detected", serde_json::json!({
                        "watch_id": watch.id,
                        "workflow_id": watch.workflow_id,
                        "trigger_file_path": path.to_string_lossy().to_string()
                    }))?;
                    let execute_result = execute_with_retry(&db_path, &watch.workflow_id, global_semaphore.clone()).await;
                    let run_result = persist_run(&db_path, &watch, &path, &event_id, execute_result).await?;
                    inflight.remove(&key);
                    if run_result {
                        failures = 0;
                    } else {
                        failures += 1;
                        if failures >= 5 {
                            pause_watch(&db_path, &watch.id)?;
                            track_analytics(&db_path, "automation_watch_paused_auto", serde_json::json!({
                                "watch_id": watch.id,
                                "workflow_id": watch.workflow_id
                            }))?;
                            return Ok(());
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
fn should_process_path(path: &Path, file_glob: &str) -> bool {
    if !path.exists() || path.is_dir() || is_temporary_file(path) {
        return false;
    }
    matches_glob(path, file_glob)
}
async fn wait_for_stable_file(path: &Path, stability_ms: i64) -> bool {
    if stability_ms <= 0 {
        return true;
    }
    let mut last_size = -1_i64;
    let mut stable_since = Instant::now();
    let start = Instant::now();
    while start.elapsed().as_millis() < (stability_ms as u128 * 4).max(10_000) {
        let size = std::fs::metadata(path).ok().map(|m| m.len() as i64).unwrap_or(-1);
        if size != last_size {
            last_size = size;
            stable_since = Instant::now();
        } else if stable_since.elapsed().as_millis() >= stability_ms as u128 {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    false
}
async fn execute_with_retry(
    db_path: &Path,
    workflow_id: &str,
    global_semaphore: Arc<Semaphore>,
) -> Result<i64, String> {
    let _permit = global_semaphore.acquire().await.map_err(|e| e.to_string())?;
    for attempt in 0..=1 {
        let started = Instant::now();
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
        let workflow = db::workflow::load_workflow(&conn, workflow_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Workflow not found: {}", workflow_id))?;
        track_analytics(db_path, "automation_run_started", serde_json::json!({"workflow_id": workflow_id}))?;
        let engine = DagEngine::new();
        match engine.execute_debug(&workflow, None).await {
            Ok(_) => return Ok(started.elapsed().as_millis() as i64),
            Err(err) if attempt == 0 => {
                let _ = err;
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            Err(err) => return Err(err),
        }
    }
    Err("execution failed".to_string())
}
async fn persist_run(
    db_path: &Path,
    watch: &crate::models::automation::AutomationWatch,
    path: &Path,
    event_id: &str,
    run_result: Result<i64, String>,
) -> Result<bool, String> {
    let started_at = Utc::now();
    let (status, duration_ms, error_message) = match run_result {
        Ok(duration) => (RunStatus::Success, duration, None),
        Err(error) => (RunStatus::Error, 0, Some(error)),
    };
    let run = AutomationRun {
        id: Uuid::new_v4().to_string(),
        watch_id: watch.id.clone(),
        workflow_id: watch.workflow_id.clone(),
        trigger_file_path: path.to_string_lossy().to_string(),
        trigger_event_id: event_id.to_string(),
        status: status.clone(),
        started_at,
        ended_at: Utc::now(),
        duration_ms,
        error_message: error_message.clone(),
    };
    let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
    db::automation::create_run(&conn, &run).map_err(|e| e.to_string())?;
    track_analytics(db_path, "automation_run_completed", serde_json::json!({
        "watch_id": watch.id, "workflow_id": watch.workflow_id, "status": status.as_str(),
        "duration_ms": duration_ms
    }))?;
    Ok(status == RunStatus::Success)
}
fn pause_watch(db_path: &Path, watch_id: &str) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
    if let Some(mut watch) = db::automation::load_watch(&conn, watch_id).map_err(|e| e.to_string())? {
        watch.status = WatchStatus::Paused;
        watch.updated_at = Utc::now();
        db::automation::update_watch(&conn, &watch).map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn track_analytics(db_path: &Path, name: &str, properties: serde_json::Value) -> Result<(), String> {
    let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
    db::analytics::track_event(&conn, name, &properties).map_err(|e| e.to_string())
}
