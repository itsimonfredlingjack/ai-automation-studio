use crate::models::automation::{
    AutomationRun, AutomationWatch, RunStatus, WatchStatus,
};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

pub fn create_watch(
    conn: &Connection,
    workflow_id: &str,
    watch_path: &str,
    recursive: bool,
    file_glob: &str,
    debounce_ms: i64,
    stability_ms: i64,
) -> rusqlite::Result<AutomationWatch> {
    let now = Utc::now();
    let watch = AutomationWatch {
        id: Uuid::new_v4().to_string(),
        workflow_id: workflow_id.to_string(),
        watch_path: watch_path.to_string(),
        recursive,
        file_glob: file_glob.to_string(),
        status: WatchStatus::Active,
        debounce_ms,
        stability_ms,
        created_at: now,
        updated_at: now,
    };
    conn.execute(
        "INSERT INTO automation_watches
         (id, workflow_id, watch_path, recursive, file_glob, status, debounce_ms, stability_ms, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            watch.id,
            watch.workflow_id,
            watch.watch_path,
            watch.recursive,
            watch.file_glob,
            watch.status.as_str(),
            watch.debounce_ms,
            watch.stability_ms,
            watch.created_at.to_rfc3339(),
            watch.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(watch)
}

pub fn update_watch(
    conn: &Connection,
    watch: &AutomationWatch,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE automation_watches
         SET watch_path=?2, recursive=?3, file_glob=?4, status=?5, debounce_ms=?6, stability_ms=?7, updated_at=?8
         WHERE id=?1",
        params![
            watch.id,
            watch.watch_path,
            watch.recursive,
            watch.file_glob,
            watch.status.as_str(),
            watch.debounce_ms,
            watch.stability_ms,
            watch.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

pub fn delete_watch(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let affected =
        conn.execute("DELETE FROM automation_watches WHERE id=?1", params![id])?;
    Ok(affected > 0)
}

pub fn load_watch(
    conn: &Connection,
    id: &str,
) -> rusqlite::Result<Option<AutomationWatch>> {
    conn.query_row(
        "SELECT id, workflow_id, watch_path, recursive, file_glob, status, debounce_ms, stability_ms, created_at, updated_at
         FROM automation_watches WHERE id=?1",
        params![id],
        map_watch_row,
    )
    .optional()
}

pub fn list_watches(conn: &Connection) -> rusqlite::Result<Vec<AutomationWatch>> {
    let mut stmt = conn.prepare(
        "SELECT id, workflow_id, watch_path, recursive, file_glob, status, debounce_ms, stability_ms, created_at, updated_at
         FROM automation_watches ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], map_watch_row)?;
    rows.collect()
}

pub fn list_active_watches(
    conn: &Connection,
) -> rusqlite::Result<Vec<AutomationWatch>> {
    let mut stmt = conn.prepare(
        "SELECT id, workflow_id, watch_path, recursive, file_glob, status, debounce_ms, stability_ms, created_at, updated_at
         FROM automation_watches WHERE status='active' ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], map_watch_row)?;
    rows.collect()
}

pub fn create_run(conn: &Connection, run: &AutomationRun) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO automation_runs
         (id, watch_id, workflow_id, trigger_file_path, trigger_event_id, status, started_at, ended_at, duration_ms, error_message)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            run.id,
            run.watch_id,
            run.workflow_id,
            run.trigger_file_path,
            run.trigger_event_id,
            run.status.as_str(),
            run.started_at.to_rfc3339(),
            run.ended_at.to_rfc3339(),
            run.duration_ms,
            run.error_message,
        ],
    )?;
    Ok(())
}

pub fn list_runs(
    conn: &Connection,
    watch_id: Option<&str>,
    workflow_id: Option<&str>,
    limit: i64,
    cursor: Option<i64>,
) -> rusqlite::Result<Vec<AutomationRun>> {
    let mut stmt = conn.prepare(
        "SELECT id, watch_id, workflow_id, trigger_file_path, trigger_event_id, status, started_at, ended_at, duration_ms, error_message
         FROM automation_runs
         WHERE (?1 IS NULL OR watch_id = ?1)
           AND (?2 IS NULL OR workflow_id = ?2)
           AND (?3 IS NULL OR rowid < ?3)
         ORDER BY rowid DESC LIMIT ?4",
    )?;
    let rows = stmt.query_map(params![watch_id, workflow_id, cursor, limit], |row| {
        Ok(AutomationRun {
            id: row.get(0)?,
            watch_id: row.get(1)?,
            workflow_id: row.get(2)?,
            trigger_file_path: row.get(3)?,
            trigger_event_id: row.get(4)?,
            status: parse_run_status(&row.get::<_, String>(5)?),
            started_at: parse_time(&row.get::<_, String>(6)?),
            ended_at: parse_time(&row.get::<_, String>(7)?),
            duration_ms: row.get(8)?,
            error_message: row.get(9)?,
        })
    })?;
    rows.collect()
}

fn map_watch_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AutomationWatch> {
    Ok(AutomationWatch {
        id: row.get(0)?,
        workflow_id: row.get(1)?,
        watch_path: row.get(2)?,
        recursive: row.get(3)?,
        file_glob: row.get(4)?,
        status: parse_watch_status(&row.get::<_, String>(5)?),
        debounce_ms: row.get(6)?,
        stability_ms: row.get(7)?,
        created_at: parse_time(&row.get::<_, String>(8)?),
        updated_at: parse_time(&row.get::<_, String>(9)?),
    })
}

fn parse_watch_status(value: &str) -> WatchStatus {
    match value {
        "active" => WatchStatus::Active,
        "paused" => WatchStatus::Paused,
        _ => WatchStatus::Disabled,
    }
}

fn parse_run_status(value: &str) -> RunStatus {
    if value == "success" {
        RunStatus::Success
    } else {
        RunStatus::Error
    }
}

fn parse_time(value: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}
