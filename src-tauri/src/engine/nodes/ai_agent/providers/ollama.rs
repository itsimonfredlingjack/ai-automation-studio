use super::{parse_arguments, value_to_tool_call, ProviderOutcome};
use crate::engine::nodes::ai_agent::analytics::AnalyticsTracker;
use crate::engine::nodes::ai_agent::config::AgentConfig;
use crate::engine::nodes::ai_agent::tools::{
    execute_tool_call, openai_tools_schema, ToolCall, ToolRuntime,
};
use reqwest::Client;
use serde_json::{json, Value};

pub async fn run_basic(client: &Client, config: &AgentConfig, prompt: &str) -> Result<String, String> {
    let url = if config.base_url.is_empty() {
        "http://localhost:11434".to_string()
    } else {
        config.base_url.trim_end_matches('/').to_string()
    };
    let mut messages = vec![];
    if !config.system_message.is_empty() {
        messages.push(json!({"role":"system","content": config.system_message}));
    }
    messages.push(json!({"role":"user","content": prompt}));
    let body = json!({
        "model": if config.model.is_empty() { "llama3" } else { &config.model },
        "messages": messages,
        "stream": false,
        "options": {"temperature": config.temperature}
    });
    let response = client.post(format!("{}/api/chat", url)).json(&body).send().await.map_err(|err| format!("Ollama request failed: {}", err))?;
    let status = response.status();
    let json: Value = response.json().await.map_err(|err| err.to_string())?;
    if !status.is_success() {
        let message = json.get("error").and_then(Value::as_str).unwrap_or("Unknown error");
        return Err(format!("Ollama error ({}): {}", status, message));
    }
    let content = json["message"]["content"].as_str().unwrap_or("").to_string();
    let thinking = json["message"]["thinking"].as_str().unwrap_or("").to_string();
    if content.is_empty() && thinking.is_empty() {
        return Err("No content in Ollama response".to_string());
    }
    Ok(if content.is_empty() { thinking } else { content })
}

pub async fn run_with_tools(
    client: &Client,
    config: &AgentConfig,
    prompt: &str,
    runtime: &ToolRuntime,
    tracker: &AnalyticsTracker,
) -> Result<ProviderOutcome, String> {
    let url = if config.base_url.is_empty() {
        "http://localhost:11434".to_string()
    } else {
        config.base_url.trim_end_matches('/').to_string()
    };
    let mut messages = vec![];
    if !config.system_message.is_empty() {
        messages.push(json!({"role":"system","content": config.system_message}));
    }
    messages.push(json!({"role":"user","content": prompt}));
    let mut tool_calls_count = 0usize;

    for _ in 0..config.max_tool_rounds {
        let body = json!({
            "model": if config.model.is_empty() { "llama3" } else { &config.model },
            "messages": messages,
            "tools": openai_tools_schema(),
            "stream": false,
            "options": {"temperature": config.temperature}
        });
        let response = client.post(format!("{}/api/chat", url)).json(&body).send().await.map_err(|err| format!("Ollama request failed: {}", err))?;
        let status = response.status();
        let json: Value = response.json().await.map_err(|err| err.to_string())?;
        if !status.is_success() {
            let message = json.get("error").and_then(Value::as_str).unwrap_or("Unknown error");
            return Err(format!("Ollama error ({}): {}", status, message));
        }
        let message = json.get("message").cloned().unwrap_or_else(|| json!({}));
        let calls = parse_tool_calls(&message);
        if calls.is_empty() {
            let content = message.get("content").and_then(Value::as_str).unwrap_or("").to_string();
            let thinking = message.get("thinking").and_then(Value::as_str).unwrap_or("").to_string();
            let text = if content.is_empty() { thinking } else { content };
            if text.trim().is_empty() {
                return Err("Ollama tool mode ended without final text".to_string());
            }
            return Ok(ProviderOutcome { text, tool_calls_count });
        }
        messages.push(message);
        for call in calls {
            tool_calls_count += 1;
            let output = execute_tool_call(&call, runtime, tracker).await;
            messages.push(json!({
                "role": "tool",
                "name": call.name,
                "content": serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string()),
            }));
        }
    }
    Err(format!("Ollama tool mode exceeded max rounds ({})", config.max_tool_rounds))
}

fn parse_tool_calls(message: &Value) -> Vec<ToolCall> {
    message.get("tool_calls").and_then(Value::as_array).map(|calls| {
        calls.iter().enumerate().filter_map(|(index, call)| {
            let name = call.get("function").and_then(|value| value.get("name")).and_then(Value::as_str);
            let args = parse_arguments(call.get("function").and_then(|value| value.get("arguments")));
            value_to_tool_call(format!("ollama-call-{}", index), name, args)
        }).collect()
    }).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::parse_tool_calls;

    #[test]
    fn parses_ollama_tool_calls() {
        let message = serde_json::json!({
            "tool_calls":[{"function":{"name":"write_json_file","arguments":{"path":"_processed/a.json","json":{"ok":true}}}}]
        });
        let calls = parse_tool_calls(&message);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "write_json_file");
        assert_eq!(calls[0].arguments["json"]["ok"], true);
    }
}
