use crate::models::runtime_alert::{
    RuntimeAlert,
    RuntimeAlertSeverity,
    RuntimeAlertSource,
};
use rusqlite::{params, Connection};
use std::path::Path;
use uuid::Uuid;

pub fn create_alert(conn: &Connection, alert: &RuntimeAlert) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO runtime_alerts
         (id, source, severity, workflow_id, watch_id, schedule_id, message, details_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            alert.id,
            alert.source.as_str(),
            alert.severity.as_str(),
            alert.workflow_id,
            alert.watch_id,
            alert.schedule_id,
            alert.message,
            serde_json::to_string(&alert.details_json).unwrap_or_else(|_| "{}".to_string()),
            alert.created_at.to_rfc3339(),
        ],
    )?;

    conn.execute(
        "DELETE FROM runtime_alerts
         WHERE id IN (
            SELECT id FROM runtime_alerts
            ORDER BY created_at DESC
            LIMIT -1 OFFSET 100
         )",
        [],
    )?;
    Ok(())
}

pub fn list_alerts(conn: &Connection, limit: i64) -> rusqlite::Result<Vec<RuntimeAlert>> {
    let mut stmt = conn.prepare(
        "SELECT id, source, severity, workflow_id, watch_id, schedule_id, message, details_json, created_at
         FROM runtime_alerts
         ORDER BY created_at DESC
         LIMIT ?1",
    )?;

    let rows = stmt.query_map(params![limit.max(1)], map_alert_row)?;
    rows.collect()
}

pub fn append_alert(
    db_path: &Path,
    source: RuntimeAlertSource,
    severity: RuntimeAlertSeverity,
    workflow_id: Option<&str>,
    watch_id: Option<&str>,
    schedule_id: Option<&str>,
    message: String,
    details_json: serde_json::Value,
) -> Result<(), String> {
    let conn = crate::db::open_connection(db_path).map_err(|error| error.to_string())?;
    let alert = RuntimeAlert {
        id: Uuid::new_v4().to_string(),
        source,
        severity,
        workflow_id: workflow_id.map(str::to_string),
        watch_id: watch_id.map(str::to_string),
        schedule_id: schedule_id.map(str::to_string),
        message,
        details_json,
        created_at: chrono::Utc::now(),
    };
    create_alert(&conn, &alert).map_err(|error| error.to_string())
}

fn map_alert_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<RuntimeAlert> {
    let details_json: String = row.get(7)?;
    let created_at: String = row.get(8)?;

    Ok(RuntimeAlert {
        id: row.get(0)?,
        source: RuntimeAlertSource::from_str(row.get::<_, String>(1)?.as_str())?,
        severity: RuntimeAlertSeverity::from_str(row.get::<_, String>(2)?.as_str())?,
        workflow_id: row.get(3)?,
        watch_id: row.get(4)?,
        schedule_id: row.get(5)?,
        message: row.get(6)?,
        details_json: serde_json::from_str(&details_json).unwrap_or_else(|_| serde_json::json!({})),
        created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
            .map(|value| value.with_timezone(&chrono::Utc))
            .map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    8,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?,
    })
}

#[cfg(test)]
mod tests {
    use super::{create_alert, list_alerts};
    use crate::db::schema::initialize_db;
    use crate::models::runtime_alert::{RuntimeAlert, RuntimeAlertSeverity, RuntimeAlertSource};
    use chrono::{Duration, Utc};
    use rusqlite::Connection;
    use serde_json::json;
    use uuid::Uuid;

    fn build_alert(index: i64) -> RuntimeAlert {
        RuntimeAlert {
            id: Uuid::new_v4().to_string(),
            source: if index % 2 == 0 {
                RuntimeAlertSource::WebhookBind
            } else {
                RuntimeAlertSource::WatchRunner
            },
            severity: if index % 2 == 0 {
                RuntimeAlertSeverity::Error
            } else {
                RuntimeAlertSeverity::Warning
            },
            workflow_id: Some(format!("wf-{index}")),
            watch_id: None,
            schedule_id: None,
            message: format!("alert-{index}"),
            details_json: json!({ "index": index }),
            created_at: Utc::now() + Duration::seconds(index),
        }
    }

    #[test]
    fn list_alerts_returns_latest_first_and_prunes_to_100_rows() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        initialize_db(&conn).expect("schema initialized");

        for index in 0..105 {
            create_alert(&conn, &build_alert(index)).expect("alert inserted");
        }

        let alerts = list_alerts(&conn, 120).expect("alerts listed");

        assert_eq!(alerts.len(), 100);
        assert_eq!(alerts.first().map(|alert| alert.message.as_str()), Some("alert-104"));
        assert_eq!(alerts.last().map(|alert| alert.message.as_str()), Some("alert-5"));
    }
}
