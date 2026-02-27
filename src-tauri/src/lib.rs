mod commands;
mod db;
mod automation;
pub mod engine;
mod error;
mod models;
mod state;
mod webhook;

use rusqlite::Connection;
use state::AppState;
use std::sync::Mutex;
use automation::manager::AutomationManager;
use tauri::Manager;
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
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db_path: db_path.clone(),
            db: Mutex::new(conn),
            webhooks: Mutex::new(WebhookManager::new(db_path)),
            automations: Mutex::new(AutomationManager::new(
                app_dir.join("synapse.db"),
                cfg!(debug_assertions),
            )),
        })
        .setup(|app| {
            let state = app.state::<AppState>();
            commands::automation::initialize_automation_runner(&state)
                .map_err(|e| e.to_string())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ai_system::check_gpt_oss_status,
            commands::analytics::track_event,
            commands::automation::list_watches,
            commands::automation::create_watch,
            commands::automation::update_watch,
            commands::automation::toggle_watch,
            commands::automation::delete_watch,
            commands::automation::list_automation_runs,
            commands::automation::get_automation_runner_enabled,
            commands::automation::set_automation_runner_enabled,
            commands::automation_schedule::list_schedules,
            commands::automation_schedule::create_schedule,
            commands::automation_schedule::toggle_schedule,
            commands::automation_schedule::delete_schedule,
            commands::automation_schedule::list_schedule_runs,
            commands::automation_ops::run_watch_now,
            commands::automation_ops::get_last_failed_run,
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
