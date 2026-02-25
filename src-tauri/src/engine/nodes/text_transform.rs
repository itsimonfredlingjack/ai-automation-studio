use async_trait::async_trait;
use std::collections::HashMap;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};

pub struct TextTransformExecutor;

#[async_trait]
impl NodeExecutor for TextTransformExecutor {
    fn node_type(&self) -> &str {
        "text_transform"
    }

    fn input_types(&self) -> Vec<(&str, &str)> {
        vec![("input", "text")]
    }

    fn output_types(&self) -> Vec<(&str, &str)> {
        vec![("output", "text")]
    }

    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String> {
        let input = match ctx.inputs.get("input") {
            Some(NodeData::Text(t)) => t.clone(),
            _ => return Err("text_transform requires text input".to_string()),
        };

        // Read transform type from config
        let transform = match ctx.inputs.get("_config") {
            Some(NodeData::Json(config)) => config
                .get("transform")
                .and_then(|v| v.as_str())
                .unwrap_or("uppercase")
                .to_string(),
            _ => "uppercase".to_string(),
        };

        let transformed = match transform.as_str() {
            "uppercase" => input.to_uppercase(),
            "lowercase" => input.to_lowercase(),
            "trim" => input.trim().to_string(),
            "reverse" => input.chars().rev().collect(),
            _ => input,
        };

        let mut out = HashMap::new();
        out.insert("output".to_string(), NodeData::Text(transformed));
        Ok(out)
    }
}
