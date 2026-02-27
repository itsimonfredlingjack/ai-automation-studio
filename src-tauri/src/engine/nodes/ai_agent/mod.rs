mod analytics;
mod config;
mod providers;
mod tools;
#[cfg(test)]
mod tools_tests;

use async_trait::async_trait;
use config::AgentConfig;
use providers::ProviderOutcome;
use std::collections::HashMap;
use std::time::Instant;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};
use serde_json::json;

pub struct AiAgentExecutor;

#[async_trait]
impl NodeExecutor for AiAgentExecutor {
    fn node_type(&self) -> &str {
        "ai_agent"
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
        let config_json = match ctx.inputs.get("_config") {
            Some(NodeData::Json(value)) => value.clone(),
            _ => return Err("AI Agent node requires configuration".to_string()),
        };
        let globals = match ctx.inputs.get("_globals") {
            Some(NodeData::Json(value)) => Some(value.clone()),
            _ => None,
        };
        let tracker = analytics::AnalyticsTracker::from_globals(globals.as_ref());
        let config = AgentConfig::from_json(&config_json);
        let prompt = read_prompt(&ctx.inputs, &config_json)?;
        let started = Instant::now();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|err| format!("Failed to create HTTP client: {}", err))?;

        let result = if config.tool_mode {
            run_tool_mode(&client, &config, &prompt, globals.as_ref(), &tracker).await
        } else {
            providers::run_basic(&client, &config, &prompt).await.map(|text| ProviderOutcome {
                text,
                tool_calls_count: 0,
            })
        };

        let duration_ms = started.elapsed().as_millis() as u64;
        match result {
            Ok(outcome) => {
                tracker.track("agent_tool_run_completed", json!({
                    "provider": config.provider,
                    "model": config.model,
                    "tool_calls_count": outcome.tool_calls_count,
                    "status": "success",
                    "duration_ms": duration_ms
                }));
                Ok(HashMap::from([("output".to_string(), NodeData::Text(outcome.text))]))
            }
            Err(error) => {
                tracker.track("agent_tool_run_completed", json!({
                    "provider": config.provider,
                    "model": config.model,
                    "tool_calls_count": 0,
                    "status": "error",
                    "duration_ms": duration_ms,
                    "error": error
                }));
                Err(error)
            }
        }
    }
}

fn read_prompt(
    inputs: &HashMap<String, NodeData>,
    config: &serde_json::Value,
) -> Result<String, String> {
    let prompt = match inputs.get("input") {
        Some(NodeData::Text(value)) => value.clone(),
        Some(NodeData::Json(value)) => serde_json::to_string(value).unwrap_or_default(),
        _ => config
            .get("prompt")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("")
            .to_string(),
    };
    if prompt.trim().is_empty() {
        return Err("AI Agent requires a prompt (connect an input or set in config)".to_string());
    }
    Ok(prompt)
}

async fn run_tool_mode(
    client: &reqwest::Client,
    config: &AgentConfig,
    prompt: &str,
    globals: Option<&serde_json::Value>,
    tracker: &analytics::AnalyticsTracker,
) -> Result<ProviderOutcome, String> {
    if config.tool_profile != "doc_pipeline_v1" {
        return Err("tool_mode currently supports tool_profile=doc_pipeline_v1 only".to_string());
    }
    let runtime = tools::ToolRuntime::new(config, globals)?;
    let stem = runtime
        .processed_dir
        .parent()
        .and_then(|value| value.file_name())
        .and_then(|value| value.to_str())
        .unwrap_or("source");
    let guided_prompt = format!(
        "{}\n\nUse doc_pipeline_v1 tools only. Ensure output files exist in _processed for source '{}'. Required outputs: <basename>.summary.md and <basename>.meta.json.",
        prompt, stem
    );
    let outcome = providers::run_with_tools(client, config, &guided_prompt, &runtime, tracker).await?;
    tools::validate_output_contract(&runtime, config, outcome.tool_calls_count)?;
    Ok(outcome)
}
