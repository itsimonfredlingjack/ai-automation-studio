use serde_json::Value;

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    pub system_message: String,
    pub temperature: f64,
    pub tool_mode: bool,
    pub tool_profile: String,
    pub max_tool_rounds: usize,
    pub processed_output_mode: String,
    pub source_path: Option<String>,
}

impl AgentConfig {
    pub fn from_json(config: &Value) -> Self {
        Self {
            provider: config
                .get("provider")
                .and_then(Value::as_str)
                .unwrap_or("openai")
                .to_string(),
            api_key: config
                .get("api_key")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            model: config
                .get("model")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            base_url: config
                .get("base_url")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            system_message: config
                .get("system_message")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            temperature: config
                .get("temperature")
                .and_then(Value::as_f64)
                .unwrap_or(0.7),
            tool_mode: config
                .get("tool_mode")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            tool_profile: config
                .get("tool_profile")
                .and_then(Value::as_str)
                .unwrap_or("doc_pipeline_v1")
                .to_string(),
            max_tool_rounds: config
                .get("max_tool_rounds")
                .and_then(Value::as_u64)
                .map(|value| value.clamp(1, 8) as usize)
                .unwrap_or(4),
            processed_output_mode: config
                .get("processed_output_mode")
                .and_then(Value::as_str)
                .unwrap_or("sibling_processed")
                .to_string(),
            source_path: config
                .get("source_path")
                .and_then(Value::as_str)
                .map(|value| value.to_string()),
        }
    }
}
