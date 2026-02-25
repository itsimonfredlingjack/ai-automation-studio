use async_trait::async_trait;
use std::collections::HashMap;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};

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
        let config = match ctx.inputs.get("_config") {
            Some(NodeData::Json(c)) => c.clone(),
            _ => return Err("AI Agent node requires configuration".to_string()),
        };

        let provider = config
            .get("provider")
            .and_then(|v| v.as_str())
            .unwrap_or("openai");
        let api_key = config
            .get("api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let model = config
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let base_url = config
            .get("base_url")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let system_message = config
            .get("system_message")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let temperature = config
            .get("temperature")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.7);

        // Get prompt from upstream input or config fallback
        let prompt = match ctx.inputs.get("input") {
            Some(NodeData::Text(t)) => t.clone(),
            Some(NodeData::Json(j)) => serde_json::to_string(j).unwrap_or_default(),
            _ => config
                .get("prompt")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        };

        if prompt.is_empty() {
            return Err("AI Agent requires a prompt (connect an input or set in config)".to_string());
        }

        let client = reqwest::Client::new();

        let response_text = match provider {
            "openai" => {
                call_openai(&client, base_url, api_key, model, system_message, &prompt, temperature)
                    .await?
            }
            "anthropic" => {
                call_anthropic(&client, base_url, api_key, model, system_message, &prompt, temperature)
                    .await?
            }
            "ollama" => {
                call_ollama(&client, base_url, model, system_message, &prompt, temperature)
                    .await?
            }
            _ => return Err(format!("Unknown provider: {}", provider)),
        };

        let mut out = HashMap::new();
        out.insert("output".to_string(), NodeData::Text(response_text));
        Ok(out)
    }
}

async fn call_openai(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    system_message: &str,
    prompt: &str,
    temperature: f64,
) -> Result<String, String> {
    let url = if base_url.is_empty() {
        "https://api.openai.com/v1".to_string()
    } else {
        base_url.trim_end_matches('/').to_string()
    };

    let model = if model.is_empty() { "gpt-4o-mini" } else { model };

    let mut messages = vec![];
    if !system_message.is_empty() {
        messages.push(serde_json::json!({"role": "system", "content": system_message}));
    }
    messages.push(serde_json::json!({"role": "user", "content": prompt}));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": temperature,
    });

    let resp = client
        .post(format!("{}/chat/completions", url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    let status = resp.status();
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    if !status.is_success() {
        let error_msg = json
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown error");
        return Err(format!("OpenAI error ({}): {}", status, error_msg));
    }

    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No content in OpenAI response".to_string())
}

async fn call_anthropic(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    system_message: &str,
    prompt: &str,
    temperature: f64,
) -> Result<String, String> {
    let url = if base_url.is_empty() {
        "https://api.anthropic.com".to_string()
    } else {
        base_url.trim_end_matches('/').to_string()
    };

    let model = if model.is_empty() {
        "claude-sonnet-4-20250514"
    } else {
        model
    };

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
    });

    if !system_message.is_empty() {
        body["system"] = serde_json::Value::String(system_message.to_string());
    }

    let resp = client
        .post(format!("{}/v1/messages", url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    let status = resp.status();
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

    if !status.is_success() {
        let error_msg = json
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown error");
        return Err(format!("Anthropic error ({}): {}", status, error_msg));
    }

    json["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No content in Anthropic response".to_string())
}

async fn call_ollama(
    client: &reqwest::Client,
    base_url: &str,
    model: &str,
    system_message: &str,
    prompt: &str,
    temperature: f64,
) -> Result<String, String> {
    let url = if base_url.is_empty() {
        "http://localhost:11434".to_string()
    } else {
        base_url.trim_end_matches('/').to_string()
    };

    let model = if model.is_empty() { "llama3" } else { model };

    let mut messages = vec![];
    if !system_message.is_empty() {
        messages.push(serde_json::json!({"role": "system", "content": system_message}));
    }
    messages.push(serde_json::json!({"role": "user", "content": prompt}));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
        "options": {
            "temperature": temperature,
        }
    });

    let resp = client
        .post(format!("{}/api/chat", url))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let status = resp.status();
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    if !status.is_success() {
        let error_msg = json
            .get("error")
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown error");
        return Err(format!("Ollama error ({}): {}", status, error_msg));
    }

    json["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No content in Ollama response".to_string())
}
