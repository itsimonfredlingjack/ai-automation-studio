use crate::automation::scheduler::spawn_schedule_task;
use crate::automation::worker::spawn_watch_task;
use crate::db;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{oneshot, Semaphore};

struct WatchHandle {
    shutdown_tx: Option<oneshot::Sender<()>>,
}

pub struct AutomationManager {
    db_path: PathBuf,
    enabled: bool,
    active: HashMap<String, WatchHandle>,
    schedule_shutdown_tx: Option<oneshot::Sender<()>>,
    global_semaphore: Arc<Semaphore>,
}

impl AutomationManager {
    pub fn new(db_path: PathBuf, enabled: bool) -> Self {
        Self {
            db_path,
            enabled,
            active: HashMap::new(),
            schedule_shutdown_tx: None,
            global_semaphore: Arc::new(Semaphore::new(2)),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn set_enabled(&mut self, enabled: bool) -> Result<(), String> {
        self.enabled = enabled;
        if enabled {
            self.sync_from_db()
        } else {
            self.stop_all();
            Ok(())
        }
    }

    pub fn sync_from_db(&mut self) -> Result<(), String> {
        self.stop_all();
        if !self.enabled {
            return Ok(());
        }

        let conn = rusqlite::Connection::open(&self.db_path)
            .map_err(|e| e.to_string())?;
        let active_watches =
            db::automation::list_active_watches(&conn).map_err(|e| e.to_string())?;

        for watch in active_watches {
            let shutdown_tx = spawn_watch_task(
                self.db_path.clone(),
                watch.clone(),
                self.global_semaphore.clone(),
            );
            self.active.insert(
                watch.id,
                WatchHandle {
                    shutdown_tx: Some(shutdown_tx),
                },
            );
        }
        self.schedule_shutdown_tx = Some(spawn_schedule_task(
            self.db_path.clone(),
            self.global_semaphore.clone(),
        ));
        Ok(())
    }

    fn stop_all(&mut self) {
        if let Some(tx) = self.schedule_shutdown_tx.take() {
            let _ = tx.send(());
        }
        for handle in self.active.values_mut() {
            if let Some(tx) = handle.shutdown_tx.take() {
                let _ = tx.send(());
            }
        }
        self.active.clear();
    }
}
