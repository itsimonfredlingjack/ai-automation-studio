use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Data flowing between nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum NodeData {
    Text(String),
    Json(serde_json::Value),
    Empty,
}

/// Execution context passed to each node
pub struct ExecutionContext {
    pub inputs: HashMap<String, NodeData>,
}

/// Trait that all node types implement
#[async_trait]
pub trait NodeExecutor: Send + Sync {
    fn node_type(&self) -> &str;
    fn input_types(&self) -> Vec<(&str, &str)>;
    fn output_types(&self) -> Vec<(&str, &str)>;
    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String>;
}

/// Registry of available node executors
pub struct NodeRegistry {
    executors: HashMap<String, Box<dyn NodeExecutor>>,
}

impl Default for NodeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            executors: HashMap::new(),
        };
        registry.register(Box::new(super::nodes::text_input::TextInputExecutor));
        registry.register(Box::new(
            super::nodes::text_transform::TextTransformExecutor,
        ));
        registry.register(Box::new(super::nodes::text_output::TextOutputExecutor));
        registry.register(Box::new(super::nodes::code_js::CodeJsExecutor));
        registry.register(Box::new(super::nodes::file_sort::FileSortExecutor));
        registry.register(Box::new(super::nodes::ai_agent::AiAgentExecutor));
        registry.register(Box::new(super::nodes::switch::SwitchExecutor));
        registry.register(Box::new(
            super::nodes::webhook_trigger::WebhookTriggerExecutor,
        ));
        registry.register(Box::new(
            super::nodes::webhook_respond::WebhookRespondExecutor,
        ));
        registry
    }

    pub fn register(&mut self, executor: Box<dyn NodeExecutor>) {
        self.executors
            .insert(executor.node_type().to_string(), executor);
    }

    pub fn get(&self, node_type: &str) -> Option<&dyn NodeExecutor> {
        self.executors.get(node_type).map(|e| e.as_ref())
    }
}
