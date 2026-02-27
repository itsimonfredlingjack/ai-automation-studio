use crate::models::workflow::{Workflow, WorkflowMetadata};
use rusqlite::{params, Connection};

pub fn save_workflow(conn: &Connection, workflow: &Workflow) -> rusqlite::Result<()> {
    let nodes_json = serde_json::to_string(&workflow.nodes).unwrap();
    let edges_json = serde_json::to_string(&workflow.edges).unwrap();

    conn.execute(
        "INSERT INTO workflows (id, name, description, nodes_json, edges_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            nodes_json = excluded.nodes_json,
            edges_json = excluded.edges_json,
            updated_at = excluded.updated_at",
        params![
            workflow.id,
            workflow.name,
            workflow.description,
            nodes_json,
            edges_json,
            workflow.created_at.to_rfc3339(),
            workflow.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

pub fn load_workflow(conn: &Connection, id: &str) -> rusqlite::Result<Option<Workflow>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, nodes_json, edges_json, created_at, updated_at
         FROM workflows WHERE id = ?1",
    )?;

    let result = stmt.query_row(params![id], |row| {
        let nodes_json: String = row.get(3)?;
        let edges_json: String = row.get(4)?;
        let created_str: String = row.get(5)?;
        let updated_str: String = row.get(6)?;

        Ok(Workflow {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            nodes: serde_json::from_str(&nodes_json).unwrap_or_default(),
            edges: serde_json::from_str(&edges_json).unwrap_or_default(),
            created_at: parse_rfc3339(&created_str, 5)?,
            updated_at: parse_rfc3339(&updated_str, 6)?,
        })
    });

    match result {
        Ok(w) => Ok(Some(w)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn list_workflows(conn: &Connection) -> rusqlite::Result<Vec<WorkflowMetadata>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, created_at, updated_at
         FROM workflows ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        let created_str: String = row.get(3)?;
        let updated_str: String = row.get(4)?;
        Ok(WorkflowMetadata {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            created_at: parse_rfc3339(&created_str, 3)?,
            updated_at: parse_rfc3339(&updated_str, 4)?,
        })
    })?;

    rows.collect()
}

pub fn delete_workflow(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let affected = conn.execute("DELETE FROM workflows WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

fn parse_rfc3339(value: &str, column: usize) -> rusqlite::Result<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|datetime| datetime.with_timezone(&chrono::Utc))
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                column,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::load_workflow;
    use crate::db::schema::initialize_db;
    use rusqlite::{params, Connection};

    #[test]
    fn load_workflow_returns_error_for_invalid_timestamp() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        initialize_db(&conn).expect("schema initialized");

        conn.execute(
            "INSERT INTO workflows (id, name, description, nodes_json, edges_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "wf-invalid-ts",
                "Invalid Timestamp Workflow",
                Option::<String>::None,
                "[]",
                "[]",
                "not-a-timestamp",
                "2026-01-01T00:00:00Z",
            ],
        )
        .expect("workflow inserted");

        let result = load_workflow(&conn, "wf-invalid-ts");

        assert!(result.is_err());
    }
}
