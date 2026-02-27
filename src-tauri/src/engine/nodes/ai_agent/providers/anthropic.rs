use super::{value_to_tool_call, ProviderOutcome};
use crate::engine::nodes::ai_agent::analytics::AnalyticsTracker;
use crate::engine::nodes::ai_agent::config::AgentConfig;
use crate::engine::nodes::ai_agent::tools::{
    anthropic_tools_schema, execute_tool_call, ToolCall, ToolRuntime,
};
use reqwest::Client;
use serde_json::{json, Value};

pub async fn run_basic(client: &Client, config: &AgentConfig, prompt: &str) -> Result<String, String> {
    let url = if config.base_url.is_empty() {
        "https://api.anthropic.com".to_string()
    } else {
        config.base_url.trim_end_matches('/').to_string()
    };
    let mut body = json!({
        "model": if config.model.is_empty() { "claude-sonnet-4-20250514" } else { &config.model },
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": config.temperature,
    });
    if !config.system_message.is_empty() {
        body["system"] = Value::String(config.system_message.clone());
    }
    let response = client
        .post(format!("{}/v1/messages", url))
        .header("x-api-key", config.api_key.clone())
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("Anthropic request failed: {}", err))?;
    let status = response.status();
    let json: Value = response.json().await.map_err(|err| err.to_string())?;
    if !status.is_success() {
        let message = json.get("error").and_then(|err| err.get("message")).and_then(Value::as_str).unwrap_or("Unknown error");
        return Err(format!("Anthropic error ({}): {}", status, message));
    }
    json["content"][0]["text"].as_str().map(|value| value.to_string()).ok_or_else(|| "No content in Anthropic response".to_string())
}

pub async fn run_with_tools(
    client: &Client,
    config: &AgentConfig,
    prompt: &str,
    runtime: &ToolRuntime,
    tracker: &AnalyticsTracker,
) -> Result<ProviderOutcome, String> {
    let url = if config.base_url.is_empty() {
        "https://api.anthropic.com".to_string()
    } else {
        config.base_url.trim_end_matches('/').to_string()
    };
    let mut messages = vec![json!({"role":"user","content": prompt})];
    let mut tool_calls_count = 0usize;

    for _ in 0..config.max_tool_rounds {
        let mut body = json!({
            "model": if config.model.is_empty() { "claude-sonnet-4-20250514" } else { &config.model },
            "max_tokens": 4096,
            "messages": messages,
            "tools": anthropic_tools_schema(),
            "temperature": config.temperature,
        });
        if !config.system_message.is_empty() {
            body["system"] = Value::String(config.system_message.clone());
        }
        let response = client
            .post(format!("{}/v1/messages", url))
            .header("x-api-key", config.api_key.clone())
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|err| format!("Anthropic request failed: {}", err))?;
        let status = response.status();
        let json: Value = response.json().await.map_err(|err| err.to_string())?;
        if !status.is_success() {
            let message = json.get("error").and_then(|err| err.get("message")).and_then(Value::as_str).unwrap_or("Unknown error");
            return Err(format!("Anthropic error ({}): {}", status, message));
        }
        let content = json.get("content").and_then(Value::as_array).cloned().unwrap_or_default();
        let calls = parse_tool_calls(&content);
        if calls.is_empty() {
            let text = content.iter().filter(|value| value.get("type").and_then(Value::as_str) == Some("text")).filter_map(|value| value.get("text").and_then(Value::as_str)).collect::<Vec<_>>().join("\n");
            if text.trim().is_empty() {
                return Err("Anthropic tool mode ended without final text".to_string());
            }
            return Ok(ProviderOutcome { text, tool_calls_count });
        }

        messages.push(json!({"role":"assistant","content": content}));
        let mut results = vec![];
        for call in calls {
            tool_calls_count += 1;
            let output = execute_tool_call(&call, runtime, tracker).await;
            results.push(json!({"type":"tool_result","tool_use_id": call.id,"content": serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string())}));
        }
        messages.push(json!({"role":"user","content": results}));
    }
    Err(format!("Anthropic tool mode exceeded max rounds ({})", config.max_tool_rounds))
}

fn parse_tool_calls(content: &[Value]) -> Vec<ToolCall> {
    content.iter().filter_map(|item| {
        if item.get("type").and_then(Value::as_str) != Some("tool_use") {
            return None;
        }
        let id = item.get("id").and_then(Value::as_str).unwrap_or("anthropic-call").to_string();
        let name = item.get("name").and_then(Value::as_str);
        let args = item.get("input").cloned();
        value_to_tool_call(id, name, args)
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::parse_tool_calls;

    #[test]
    fn parses_anthropic_tool_use_blocks() {
        let content = vec![serde_json::json!({"type":"tool_use","id":"tu_1","name":"ensure_dir","input":{"path":"_processed"}})];
        let calls = parse_tool_calls(&content);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "ensure_dir");
        assert_eq!(calls[0].arguments["path"], "_processed");
    }
}
