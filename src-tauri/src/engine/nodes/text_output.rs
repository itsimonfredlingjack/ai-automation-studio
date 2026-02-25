use async_trait::async_trait;
use std::collections::HashMap;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};

pub struct TextOutputExecutor;

#[async_trait]
impl NodeExecutor for TextOutputExecutor {
    fn node_type(&self) -> &str {
        "text_output"
    }

    fn input_types(&self) -> Vec<(&str, &str)> {
        vec![("input", "text")]
    }

    fn output_types(&self) -> Vec<(&str, &str)> {
        vec![]
    }

    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String> {
        let input = match ctx.inputs.get("input") {
            Some(data) => data.clone(),
            None => NodeData::Empty,
        };

        let mut out = HashMap::new();
        out.insert("output".to_string(), input);
        Ok(out)
    }
}
