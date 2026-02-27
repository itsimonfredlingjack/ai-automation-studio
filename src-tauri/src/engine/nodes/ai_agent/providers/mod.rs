mod anthropic;
mod ollama;
mod openai;

use crate::engine::nodes::ai_agent::analytics::AnalyticsTracker;
use crate::engine::nodes::ai_agent::config::AgentConfig;
use crate::engine::nodes::ai_agent::tools::{ToolCall, ToolRuntime};
use reqwest::Client;
use serde_json::Value;

#[derive(Debug, Clone)]
pub struct ProviderOutcome {
    pub text: String,
    pub tool_calls_count: usize,
}

pub async fn run_basic(
    client: &Client,
    config: &AgentConfig,
    prompt: &str,
) -> Result<String, String> {
    match config.provider.as_str() {
        "openai" => openai::run_basic(client, config, prompt).await,
        "anthropic" => anthropic::run_basic(client, config, prompt).await,
        "ollama" => ollama::run_basic(client, config, prompt).await,
        provider => Err(format!("Unknown provider: {}", provider)),
    }
}

pub async fn run_with_tools(
    client: &Client,
    config: &AgentConfig,
    prompt: &str,
    runtime: &ToolRuntime,
    tracker: &AnalyticsTracker,
) -> Result<ProviderOutcome, String> {
    match config.provider.as_str() {
        "openai" => openai::run_with_tools(client, config, prompt, runtime, tracker).await,
        "anthropic" => anthropic::run_with_tools(client, config, prompt, runtime, tracker).await,
        "ollama" => ollama::run_with_tools(client, config, prompt, runtime, tracker).await,
        provider => Err(format!("Unknown provider: {}", provider)),
    }
}

fn value_to_tool_call(
    id: String,
    name: Option<&str>,
    arguments: Option<Value>,
) -> Option<ToolCall> {
    let name = name?.trim();
    if name.is_empty() {
        return None;
    }
    Some(ToolCall {
        id,
        name: name.to_string(),
        arguments: arguments.unwrap_or_else(|| serde_json::json!({})),
    })
}

fn parse_arguments(value: Option<&Value>) -> Option<Value> {
    let raw = value?;
    if raw.is_object() {
        return Some(raw.clone());
    }
    raw.as_str()
        .and_then(|content| serde_json::from_str::<Value>(content).ok())
}
