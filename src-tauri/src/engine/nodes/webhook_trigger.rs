use async_trait::async_trait;
use std::collections::HashMap;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};

pub struct WebhookTriggerExecutor;

#[async_trait]
impl NodeExecutor for WebhookTriggerExecutor {
    fn node_type(&self) -> &str {
        "webhook_trigger"
    }

    fn input_types(&self) -> Vec<(&str, &str)> {
        vec![]
    }

    fn output_types(&self) -> Vec<(&str, &str)> {
        vec![
            ("body", "text"),
            ("headers", "json"),
            ("method", "text"),
            ("query", "json"),
        ]
    }

    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String> {
        let mut outputs = HashMap::new();

        outputs.insert(
            "body".to_string(),
            ctx.inputs
                .get("_webhook_body")
                .cloned()
                .unwrap_or(NodeData::Text(String::new())),
        );

        outputs.insert(
            "headers".to_string(),
            ctx.inputs
                .get("_webhook_headers")
                .cloned()
                .unwrap_or(NodeData::Json(serde_json::json!({}))),
        );

        outputs.insert(
            "method".to_string(),
            ctx.inputs
                .get("_webhook_method")
                .cloned()
                .unwrap_or(NodeData::Text("GET".to_string())),
        );

        outputs.insert(
            "query".to_string(),
            ctx.inputs
                .get("_webhook_query")
                .cloned()
                .unwrap_or(NodeData::Json(serde_json::json!({}))),
        );

        Ok(outputs)
    }
}
