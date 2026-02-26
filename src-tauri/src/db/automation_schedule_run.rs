use crate::models::automation_schedule::AutomationScheduleRun;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};

pub fn create_schedule_run(
    conn: &Connection,
    run: &AutomationScheduleRun,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO automation_schedule_runs
         (id, schedule_id, workflow_id, trigger_event_id, status, started_at, ended_at, duration_ms, error_message)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            run.id,
            run.schedule_id,
            run.workflow_id,
            run.trigger_event_id,
            run.status,
            run.started_at.to_rfc3339(),
            run.ended_at.to_rfc3339(),
            run.duration_ms,
            run.error_message,
        ],
    )?;
    Ok(())
}

pub fn list_schedule_runs(
    conn: &Connection,
    schedule_id: Option<&str>,
    workflow_id: Option<&str>,
    limit: i64,
    cursor: Option<i64>,
) -> rusqlite::Result<Vec<AutomationScheduleRun>> {
    let mut stmt = conn.prepare(
        "SELECT id, schedule_id, workflow_id, trigger_event_id, status, started_at, ended_at, duration_ms, error_message
         FROM automation_schedule_runs
         WHERE (?1 IS NULL OR schedule_id = ?1)
           AND (?2 IS NULL OR workflow_id = ?2)
           AND (?3 IS NULL OR rowid < ?3)
         ORDER BY rowid DESC LIMIT ?4",
    )?;
    let rows = stmt.query_map(params![schedule_id, workflow_id, cursor, limit], |row| {
        Ok(AutomationScheduleRun {
            id: row.get(0)?,
            schedule_id: row.get(1)?,
            workflow_id: row.get(2)?,
            trigger_event_id: row.get(3)?,
            status: row.get(4)?,
            started_at: parse_time(&row.get::<_, String>(5)?),
            ended_at: parse_time(&row.get::<_, String>(6)?),
            duration_ms: row.get(7)?,
            error_message: row.get(8)?,
        })
    })?;
    rows.collect()
}

fn parse_time(value: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}
