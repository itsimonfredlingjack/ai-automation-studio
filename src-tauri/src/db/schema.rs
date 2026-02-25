use rusqlite::Connection;

pub fn initialize_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            nodes_json TEXT NOT NULL DEFAULT '[]',
            edges_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_workflows_updated
            ON workflows(updated_at DESC);
        ",
    )?;
    Ok(())
}
