use async_trait::async_trait;
use std::collections::HashMap;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};

pub struct TextInputExecutor;

#[async_trait]
impl NodeExecutor for TextInputExecutor {
    fn node_type(&self) -> &str {
        "text_input"
    }

    fn input_types(&self) -> Vec<(&str, &str)> {
        vec![]
    }

    fn output_types(&self) -> Vec<(&str, &str)> {
        vec![("output", "text")]
    }

    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String> {
        // Read text from node config data
        let text = match ctx.inputs.get("_config") {
            Some(NodeData::Json(config)) => config
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            _ => String::new(),
        };

        let mut out = HashMap::new();
        out.insert("output".to_string(), NodeData::Text(text));
        Ok(out)
    }
}
