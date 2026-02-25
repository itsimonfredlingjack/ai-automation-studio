use async_trait::async_trait;
use std::collections::HashMap;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};

pub struct WebhookRespondExecutor;

#[async_trait]
impl NodeExecutor for WebhookRespondExecutor {
    fn node_type(&self) -> &str {
        "webhook_respond"
    }

    fn input_types(&self) -> Vec<(&str, &str)> {
        vec![("input", "any")]
    }

    fn output_types(&self) -> Vec<(&str, &str)> {
        vec![("output", "any")]
    }

    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String> {
        let mut outputs = HashMap::new();

        let input = ctx
            .inputs
            .get("input")
            .cloned()
            .unwrap_or(NodeData::Empty);

        outputs.insert("output".to_string(), input);
        Ok(outputs)
    }
}
