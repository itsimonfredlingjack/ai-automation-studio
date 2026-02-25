mod commands;
mod db;
pub mod engine;
mod error;
mod models;
mod state;
mod webhook;

use rusqlite::Connection;
use state::AppState;
use std::sync::Mutex;
use webhook::manager::WebhookManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    // Database path: ~/.synapse/synapse.db
    let app_dir = dirs::home_dir()
        .expect("Could not find home directory")
        .join(".synapse");
    std::fs::create_dir_all(&app_dir).expect("Could not create .synapse directory");

    let db_path = app_dir.join("synapse.db");
    let conn = Connection::open(&db_path).expect("Could not open database");

    db::schema::initialize_db(&conn).expect("Could not initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Mutex::new(conn),
            webhooks: Mutex::new(WebhookManager::new(db_path)),
        })
        .invoke_handler(tauri::generate_handler![
            commands::analytics::track_event,
            commands::workflow::save_workflow,
            commands::workflow::load_workflow,
            commands::workflow::list_workflows,
            commands::workflow::delete_workflow,
            commands::workflow::execute_workflow,
            commands::workflow::execute_workflow_debug,
            commands::webhook::start_webhook,
            commands::webhook::stop_webhook,
            commands::webhook::list_webhooks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
