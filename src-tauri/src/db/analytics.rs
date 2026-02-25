use chrono::Utc;
use rusqlite::{params, Connection};

pub fn track_event(
    conn: &Connection,
    event_name: &str,
    properties: &serde_json::Value,
) -> rusqlite::Result<()> {
    let properties_json =
        serde_json::to_string(properties).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT INTO analytics_events (event_name, properties_json, created_at)
         VALUES (?1, ?2, ?3)",
        params![event_name, properties_json, Utc::now().to_rfc3339()],
    )?;

    Ok(())
}
