use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::automation::manager::AutomationManager;
use crate::webhook::manager::WebhookManager;

pub struct AppState {
    pub db_path: PathBuf,
    pub db: Mutex<Connection>,
    pub webhooks: Mutex<WebhookManager>,
    pub automations: Mutex<AutomationManager>,
}
