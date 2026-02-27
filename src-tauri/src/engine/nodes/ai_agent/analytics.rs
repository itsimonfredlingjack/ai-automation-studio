use crate::db;
use serde_json::Value;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct AnalyticsTracker {
    db_path: Option<PathBuf>,
}

impl AnalyticsTracker {
    pub fn from_globals(globals: Option<&Value>) -> Self {
        let db_path = globals
            .and_then(|value| value.get("analytics_db_path"))
            .and_then(Value::as_str)
            .map(PathBuf::from);
        Self { db_path }
    }

    pub fn track(&self, event_name: &str, properties: Value) {
        let Some(path) = &self.db_path else {
            return;
        };
        let Ok(conn) = rusqlite::Connection::open(path) else {
            return;
        };
        let _ = db::analytics::track_event(&conn, event_name, &properties);
    }
}
