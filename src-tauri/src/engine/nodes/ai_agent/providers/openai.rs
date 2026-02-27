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
        "https://api.openai.com/v1".to_string()
    } else {
        config.base_url.trim_end_matches('/').to_string()
    };
    let mut messages = vec![];
    if !config.system_message.is_empty() {
        messages.push(json!({"role":"system","content": config.system_message}));
    }
    messages.push(json!({"role":"user","content": prompt}));
    let body = json!({
        "model": if config.model.is_empty() { "gpt-4o-mini" } else { &config.model },
        "messages": messages,
        "temperature": config.temperature,
    });
    let response = client
        .post(format!("{}/chat/completions", url))
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("OpenAI request failed: {}", err))?;
    let status = response.status();
    let json: Value = response.json().await.map_err(|err| err.to_string())?;
    if !status.is_success() {
        let message = json.get("error").and_then(|err| err.get("message")).and_then(Value::as_str).unwrap_or("Unknown error");
        return Err(format!("OpenAI error ({}): {}", status, message));
    }
    json["choices"][0]["message"]["content"].as_str().map(|value| value.to_string()).ok_or_else(|| "No content in OpenAI response".to_string())
}

pub async fn run_with_tools(
    client: &Client,
    config: &AgentConfig,
    prompt: &str,
    runtime: &ToolRuntime,
    tracker: &AnalyticsTracker,
) -> Result<ProviderOutcome, String> {
    let url = if config.base_url.is_empty() {
        "https://api.openai.com/v1".to_string()
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
            "model": if config.model.is_empty() { "gpt-4o-mini" } else { &config.model },
            "messages": messages,
            "tools": openai_tools_schema(),
            "tool_choice": "auto",
            "temperature": config.temperature,
        });
        let response = client
            .post(format!("{}/chat/completions", url))
            .header("Authorization", format!("Bearer {}", config.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|err| format!("OpenAI request failed: {}", err))?;
        let status = response.status();
        let json: Value = response.json().await.map_err(|err| err.to_string())?;
        if !status.is_success() {
            let message = json.get("error").and_then(|err| err.get("message")).and_then(Value::as_str).unwrap_or("Unknown error");
            return Err(format!("OpenAI error ({}): {}", status, message));
        }
        let message = json["choices"][0]["message"].clone();
        let tool_calls = parse_tool_calls(&message);
        if tool_calls.is_empty() {
            let text = message.get("content").and_then(Value::as_str).unwrap_or("").to_string();
            if text.is_empty() {
                return Err("OpenAI tool mode ended without final text".to_string());
            }
            return Ok(ProviderOutcome { text, tool_calls_count });
        }

        messages.push(message);
        for call in tool_calls {
            tool_calls_count += 1;
            let result = execute_tool_call(&call, runtime, tracker).await;
            messages.push(json!({
                "role": "tool",
                "tool_call_id": call.id,
                "content": serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string()),
            }));
        }
    }
    Err(format!("OpenAI tool mode exceeded max rounds ({})", config.max_tool_rounds))
}

fn parse_tool_calls(message: &Value) -> Vec<ToolCall> {
    message.get("tool_calls").and_then(Value::as_array).map(|calls| {
        calls.iter().enumerate().filter_map(|(index, call)| {
            let id = call.get("id").and_then(Value::as_str).map(|value| value.to_string()).unwrap_or_else(|| format!("openai-call-{}", index));
            let name = call.get("function").and_then(|value| value.get("name")).and_then(Value::as_str);
            let args = parse_arguments(call.get("function").and_then(|value| value.get("arguments")));
            value_to_tool_call(id, name, args)
        }).collect()
    }).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::parse_tool_calls;

    #[test]
    fn parses_openai_tool_calls() {
        let message = serde_json::json!({
            "tool_calls": [
                {"id": "call_1", "function": {"name": "read_text_file", "arguments": "{\"path\":\"./a.txt\"}"}}
            ]
        });
        let calls = parse_tool_calls(&message);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "read_text_file");
        assert_eq!(calls[0].arguments["path"], "./a.txt");
    }
}
