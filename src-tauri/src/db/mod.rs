pub mod automation;
pub mod automation_schedule;
pub mod automation_schedule_run;
pub mod analytics;
pub mod runtime_alert;
pub mod schema;
pub mod settings;
pub mod workflow;

use rusqlite::Connection;
use std::path::Path;

pub fn open_connection(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA busy_timeout = 5000;
         PRAGMA synchronous = NORMAL;",
    )?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::open_connection;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn open_connection_configures_file_backed_sqlite_pragmas() {
        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let db_path = std::env::temp_dir().join(format!("synapse-open-connection-{unique_id}.db"));

        let conn = open_connection(&db_path).expect("file-backed db");

        let journal_mode: String = conn
            .pragma_query_value(None, "journal_mode", |row: &rusqlite::Row<'_>| row.get(0))
            .expect("journal_mode pragma");
        let foreign_keys: i64 = conn
            .pragma_query_value(None, "foreign_keys", |row: &rusqlite::Row<'_>| row.get(0))
            .expect("foreign_keys pragma");
        let busy_timeout: i64 = conn
            .pragma_query_value(None, "busy_timeout", |row: &rusqlite::Row<'_>| row.get(0))
            .expect("busy_timeout pragma");
        let synchronous: i64 = conn
            .pragma_query_value(None, "synchronous", |row: &rusqlite::Row<'_>| row.get(0))
            .expect("synchronous pragma");

        assert_eq!(journal_mode.to_lowercase(), "wal");
        assert_eq!(foreign_keys, 1);
        assert_eq!(busy_timeout, 5_000);
        assert_eq!(synchronous, 1);

        drop(conn);
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    }
}
