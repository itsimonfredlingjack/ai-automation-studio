use super::executor::NodeData;
use super::DagEngine;
use crate::models::workflow::{Position, Workflow, WorkflowNode};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

fn test_root() -> std::path::PathBuf {
    std::env::temp_dir().join(format!("synapse-file-sort-engine-{}", Uuid::new_v4()))
}

#[tokio::test]
async fn executes_file_sort_node_with_trigger_file() {
    let root = test_root();
    let watch_path = root.join("incoming");
    let destination_path = root.join("sorted");
    let source_path = watch_path.join("report.pdf");
    std::fs::create_dir_all(&watch_path).unwrap();
    std::fs::create_dir_all(&destination_path).unwrap();
    std::fs::write(&source_path, "hello").unwrap();

    let workflow = Workflow {
        id: Uuid::new_v4().to_string(),
        name: "File Sort".to_string(),
        description: None,
        nodes: vec![WorkflowNode {
            id: "file-sort".to_string(),
            node_type: "file_sort".to_string(),
            position: Position { x: 0.0, y: 0.0 },
            data: json!({
                "destination_path": destination_path,
                "operation": "move",
                "conflict_policy": "keep_both"
            }),
        }],
        edges: vec![],
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let result = DagEngine::new()
        .execute_debug_with_globals(
            &workflow,
            None,
            Some(json!({
                "trigger_file_path": source_path,
            })),
        )
        .await
        .unwrap();

    let summary = result
        .steps
        .first()
        .and_then(|step| step.outputs.get("output"))
        .and_then(|value| match value {
            NodeData::Text(text) => Some(text.clone()),
            _ => None,
        })
        .unwrap();

    assert!(summary.contains("Moved report.pdf"));
    assert!(destination_path.join("report.pdf").exists());
    assert!(!source_path.exists());
}
