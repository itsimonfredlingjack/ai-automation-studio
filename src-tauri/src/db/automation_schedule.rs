use crate::automation::schedule_clock::next_run_at;
use crate::models::automation_schedule::{
    AutomationSchedule, ScheduleCadence, ScheduleStatus,
};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

pub fn create_schedule(
    conn: &Connection,
    workflow_id: &str,
    cadence: &str,
    hourly_interval: Option<i64>,
    weekly_days: &[String],
    hour: i64,
    minute: i64,
) -> rusqlite::Result<AutomationSchedule> {
    let now = Utc::now();
    let cadence_enum = parse_cadence(cadence)?;
    let interval = match cadence_enum {
        ScheduleCadence::Hourly => Some(hourly_interval.unwrap_or(1).max(1)),
        ScheduleCadence::Weekly => None,
    };
    let next_run_at = next_run_at(
        now,
        cadence_enum.as_str(),
        interval.unwrap_or(1),
        weekly_days,
        hour,
        minute,
    )
    .map_err(invalid_param)?;
    let schedule = AutomationSchedule {
        id: Uuid::new_v4().to_string(),
        workflow_id: workflow_id.to_string(),
        cadence: cadence_enum,
        hourly_interval: interval,
        weekly_days: weekly_days.to_vec(),
        hour,
        minute,
        status: ScheduleStatus::Active,
        last_run_at: None,
        next_run_at,
        created_at: now,
        updated_at: now,
    };

    conn.execute(
        "INSERT INTO automation_schedules
         (id, workflow_id, cadence, hourly_interval, weekly_days_json, hour, minute, status, last_run_at, next_run_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            schedule.id,
            schedule.workflow_id,
            schedule.cadence.as_str(),
            schedule.hourly_interval,
            serde_json::to_string(&schedule.weekly_days).unwrap_or_else(|_| "[]".to_string()),
            schedule.hour,
            schedule.minute,
            schedule.status.as_str(),
            schedule.last_run_at.map(|value| value.to_rfc3339()),
            schedule.next_run_at.to_rfc3339(),
            schedule.created_at.to_rfc3339(),
            schedule.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(schedule)
}

pub fn update_schedule(
    conn: &Connection,
    schedule: &AutomationSchedule,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE automation_schedules
         SET status=?2, last_run_at=?3, next_run_at=?4, updated_at=?5
         WHERE id=?1",
        params![
            schedule.id,
            schedule.status.as_str(),
            schedule.last_run_at.map(|value| value.to_rfc3339()),
            schedule.next_run_at.to_rfc3339(),
            schedule.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

pub fn load_schedule(
    conn: &Connection,
    id: &str,
) -> rusqlite::Result<Option<AutomationSchedule>> {
    conn.query_row(
        "SELECT id, workflow_id, cadence, hourly_interval, weekly_days_json, hour, minute, status, last_run_at, next_run_at, created_at, updated_at
         FROM automation_schedules WHERE id=?1",
        params![id],
        map_schedule_row,
    )
    .optional()
}

pub fn list_schedules(conn: &Connection) -> rusqlite::Result<Vec<AutomationSchedule>> {
    let mut stmt = conn.prepare(
        "SELECT id, workflow_id, cadence, hourly_interval, weekly_days_json, hour, minute, status, last_run_at, next_run_at, created_at, updated_at
         FROM automation_schedules ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], map_schedule_row)?;
    rows.collect()
}

pub fn list_due_schedules(
    conn: &Connection,
    now: DateTime<Utc>,
    limit: i64,
) -> rusqlite::Result<Vec<AutomationSchedule>> {
    let mut stmt = conn.prepare(
        "SELECT id, workflow_id, cadence, hourly_interval, weekly_days_json, hour, minute, status, last_run_at, next_run_at, created_at, updated_at
         FROM automation_schedules
         WHERE status='active' AND next_run_at <= ?1
         ORDER BY next_run_at ASC
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![now.to_rfc3339(), limit], map_schedule_row)?;
    rows.collect()
}

pub fn delete_schedule(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    Ok(conn.execute("DELETE FROM automation_schedules WHERE id=?1", params![id])? > 0)
}

fn map_schedule_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AutomationSchedule> {
    Ok(AutomationSchedule {
        id: row.get(0)?,
        workflow_id: row.get(1)?,
        cadence: parse_cadence(&row.get::<_, String>(2)?)?,
        hourly_interval: row.get(3)?,
        weekly_days: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
        hour: row.get(5)?,
        minute: row.get(6)?,
        status: parse_status(&row.get::<_, String>(7)?),
        last_run_at: row.get::<_, Option<String>>(8)?.map(|value| parse_time(&value)),
        next_run_at: parse_time(&row.get::<_, String>(9)?),
        created_at: parse_time(&row.get::<_, String>(10)?),
        updated_at: parse_time(&row.get::<_, String>(11)?),
    })
}

fn parse_cadence(value: &str) -> rusqlite::Result<ScheduleCadence> {
    match value {
        "hourly" => Ok(ScheduleCadence::Hourly),
        "weekly" => Ok(ScheduleCadence::Weekly),
        _ => Err(invalid_param(format!("Invalid cadence: {}", value))),
    }
}

fn parse_status(value: &str) -> ScheduleStatus {
    match value {
        "active" => ScheduleStatus::Active,
        "paused" => ScheduleStatus::Paused,
        _ => ScheduleStatus::Disabled,
    }
}

fn parse_time(value: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}

fn invalid_param(message: impl Into<String>) -> rusqlite::Error {
    rusqlite::Error::InvalidParameterName(message.into())
}
