use crate::automation::filters::{is_temporary_file, matches_glob};
use crate::db;
use crate::engine::{executor::NodeData, ExecutionOutput, DagEngine};
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
    let db_path_for_alerts = db_path.clone();
    let workflow_id = watch.workflow_id.clone();
    let watch_id = watch.id.clone();
    let watch_path = watch.watch_path.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = run_watch_loop(db_path, watch, global_semaphore, shutdown_rx).await {
            log::error!("automation watch loop failed: {}", error);
            let _ = db::runtime_alert::append_alert(
                &db_path_for_alerts,
                crate::models::runtime_alert::RuntimeAlertSource::WatchRunner,
                crate::models::runtime_alert::RuntimeAlertSeverity::Error,
                Some(&workflow_id),
                Some(&watch_id),
                None,
                format!("automation watch loop failed: {error}"),
                serde_json::json!({ "watch_path": watch_path }),
            );
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
                    let execute_result = execute_with_retry(
                        &db_path,
                        &watch,
                        &path,
                        &event_id,
                        global_semaphore.clone(),
                    )
                    .await;
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
                            let _ = db::runtime_alert::append_alert(
                                &db_path,
                                crate::models::runtime_alert::RuntimeAlertSource::WatchAutoPause,
                                crate::models::runtime_alert::RuntimeAlertSeverity::Warning,
                                Some(&watch.workflow_id),
                                Some(&watch.id),
                                None,
                                format!("Watch {} auto-paused after repeated failures.", watch.id),
                                serde_json::json!({ "watch_path": watch.watch_path }),
                            );
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
    watch: &crate::models::automation::AutomationWatch,
    path: &Path,
    event_id: &str,
    global_semaphore: Arc<Semaphore>,
) -> Result<(i64, Option<String>), String> {
    let _permit = global_semaphore.acquire().await.map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string();
    let globals = serde_json::json!({
        "trigger_source": "watch",
        "trigger_file_path": path.to_string_lossy().to_string(),
        "trigger_file_name": file_name,
        "watch_id": watch.id,
        "watch_path": watch.watch_path,
        "trigger_event_id": event_id,
        "analytics_db_path": db_path.to_string_lossy().to_string()
    });
    for attempt in 0..=1 {
        let started = Instant::now();
        let conn = db::open_connection(db_path).map_err(|e| e.to_string())?;
        let workflow = db::workflow::load_workflow(&conn, &watch.workflow_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Workflow not found: {}", watch.workflow_id))?;
        track_analytics(
            db_path,
            "automation_run_started",
            serde_json::json!({
                "workflow_id": watch.workflow_id,
                "watch_id": watch.id,
                "trigger_source": "watch"
            }),
        )?;
        let engine = DagEngine::new();
        match engine
            .execute_debug_with_globals(&workflow, None, Some(globals.clone()))
            .await
        {
            Ok(output) => {
                return Ok((
                    started.elapsed().as_millis() as i64,
                    extract_result_summary(&output),
                ))
            }
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
    run_result: Result<(i64, Option<String>), String>,
) -> Result<bool, String> {
    let started_at = Utc::now();
    let (status, duration_ms, result_summary, error_message) = match run_result {
        Ok((duration, summary)) => (RunStatus::Success, duration, summary, None),
        Err(error) => (RunStatus::Error, 0, None, Some(error)),
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
        result_summary,
        error_message: error_message.clone(),
    };
    let conn = db::open_connection(db_path).map_err(|e| e.to_string())?;
    db::automation::create_run(&conn, &run).map_err(|e| e.to_string())?;
    track_analytics(db_path, "automation_run_completed", serde_json::json!({
        "watch_id": watch.id, "workflow_id": watch.workflow_id, "status": status.as_str(),
        "duration_ms": duration_ms
    }))?;
    Ok(status == RunStatus::Success)
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
fn pause_watch(db_path: &Path, watch_id: &str) -> Result<(), String> {
    let conn = db::open_connection(db_path).map_err(|e| e.to_string())?;
    if let Some(mut watch) = db::automation::load_watch(&conn, watch_id).map_err(|e| e.to_string())? {
        watch.status = WatchStatus::Paused;
        watch.updated_at = Utc::now();
        db::automation::update_watch(&conn, &watch).map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn track_analytics(db_path: &Path, name: &str, properties: serde_json::Value) -> Result<(), String> {
    let conn = db::open_connection(db_path).map_err(|e| e.to_string())?;
    db::analytics::track_event(&conn, name, &properties).map_err(|e| e.to_string())
}
