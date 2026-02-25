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
            created_at: chrono::DateTime::parse_from_rfc3339(&created_str)
                .unwrap()
                .with_timezone(&chrono::Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&updated_str)
                .unwrap()
                .with_timezone(&chrono::Utc),
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
            created_at: chrono::DateTime::parse_from_rfc3339(&created_str)
                .unwrap()
                .with_timezone(&chrono::Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&updated_str)
                .unwrap()
                .with_timezone(&chrono::Utc),
        })
    })?;

    rows.collect()
}

pub fn delete_workflow(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    let affected = conn.execute("DELETE FROM workflows WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}
