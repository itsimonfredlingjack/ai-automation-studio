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

        CREATE TABLE IF NOT EXISTS analytics_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_name TEXT NOT NULL,
            properties_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
            ON analytics_events(event_name, created_at DESC);

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS automation_watches (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            watch_path TEXT NOT NULL,
            recursive INTEGER NOT NULL DEFAULT 1,
            file_glob TEXT NOT NULL DEFAULT '*.*',
            status TEXT NOT NULL DEFAULT 'active',
            debounce_ms INTEGER NOT NULL DEFAULT 1200,
            stability_ms INTEGER NOT NULL DEFAULT 2000,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_automation_watches_status_updated
            ON automation_watches(status, updated_at DESC);

        CREATE TABLE IF NOT EXISTS automation_runs (
            id TEXT PRIMARY KEY,
            watch_id TEXT NOT NULL,
            workflow_id TEXT NOT NULL,
            trigger_file_path TEXT NOT NULL,
            trigger_event_id TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            FOREIGN KEY (watch_id) REFERENCES automation_watches(id) ON DELETE CASCADE,
            FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_automation_runs_watch_started
            ON automation_runs(watch_id, started_at DESC);

        CREATE TABLE IF NOT EXISTS automation_schedules (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            cadence TEXT NOT NULL,
            hourly_interval INTEGER,
            weekly_days_json TEXT NOT NULL DEFAULT '[]',
            hour INTEGER NOT NULL DEFAULT 9,
            minute INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            last_run_at TEXT,
            next_run_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_automation_schedules_status_next
            ON automation_schedules(status, next_run_at ASC);

        CREATE TABLE IF NOT EXISTS automation_schedule_runs (
            id TEXT PRIMARY KEY,
            schedule_id TEXT NOT NULL,
            workflow_id TEXT NOT NULL,
            trigger_event_id TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            FOREIGN KEY (schedule_id) REFERENCES automation_schedules(id) ON DELETE CASCADE,
            FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_automation_schedule_runs_started
            ON automation_schedule_runs(schedule_id, started_at DESC);
        ",
    )?;
    Ok(())
}
