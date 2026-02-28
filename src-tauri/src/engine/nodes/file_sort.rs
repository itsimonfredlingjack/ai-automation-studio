use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};
use crate::file_ops::sort_rule::{execute_sort_rule, FileConflictPolicy};

pub struct FileSortExecutor;

#[async_trait]
impl NodeExecutor for FileSortExecutor {
    fn node_type(&self) -> &str {
        "file_sort"
    }

    fn input_types(&self) -> Vec<(&str, &str)> {
        vec![]
    }

    fn output_types(&self) -> Vec<(&str, &str)> {
        vec![("result", "json"), ("output", "text")]
    }

    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String> {
        let config = match ctx.inputs.get("_config") {
            Some(NodeData::Json(config)) => config,
            _ => return Err("file_sort node missing config".to_string()),
        };

        let destination_path = config
            .get("destination_path")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "file_sort requires destination_path".to_string())?;

        let conflict_policy = match config
            .get("conflict_policy")
            .and_then(Value::as_str)
            .unwrap_or("keep_both")
        {
            "keep_both" => FileConflictPolicy::KeepBoth,
            other => return Err(format!("unsupported conflict_policy: {other}")),
        };

        let globals = match ctx.inputs.get("_globals") {
            Some(NodeData::Json(globals)) => globals,
            _ => return Err("file_sort requires _globals".to_string()),
        };

        let source_path = globals
            .get("trigger_file_path")
            .and_then(Value::as_str)
            .ok_or_else(|| "file_sort requires trigger_file_path".to_string())?;

        let watch_path = globals
            .get("watch_path")
            .and_then(Value::as_str)
            .map(PathBuf::from)
            .or_else(|| {
                Path::new(source_path)
                    .parent()
                    .map(|value| value.to_path_buf())
            })
            .ok_or_else(|| "file_sort could not determine watch_path".to_string())?;

        let result = execute_sort_rule(
            &watch_path,
            Path::new(source_path),
            Path::new(destination_path),
            conflict_policy,
        )?;

        let mut outputs = HashMap::new();
        outputs.insert(
            "result".to_string(),
            NodeData::Json(json!({
                "source_path": result.source_path,
                "destination_dir": result.destination_dir,
                "final_path": result.final_path,
                "action": "move",
                "conflict_resolution": result.conflict_resolution,
                "summary": result.summary,
            })),
        );
        outputs.insert("output".to_string(), NodeData::Text(result.summary));
        Ok(outputs)
    }
}
