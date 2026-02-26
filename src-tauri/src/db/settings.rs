use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};

pub fn set_bool(
    conn: &Connection,
    key: &str,
    value: bool,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value_json, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at",
        params![key, serde_json::json!(value).to_string(), Utc::now().to_rfc3339()],
    )?;
    Ok(())
}

pub fn get_bool(conn: &Connection, key: &str) -> rusqlite::Result<Option<bool>> {
    let raw = conn
        .query_row(
            "SELECT value_json FROM app_settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    Ok(raw.and_then(|value| serde_json::from_str::<bool>(&value).ok()))
}
