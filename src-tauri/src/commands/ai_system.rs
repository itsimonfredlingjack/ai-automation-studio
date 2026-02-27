use crate::error::AppError;
use serde::Serialize;
use serde_json::Value;
use std::time::Instant;

const DEFAULT_BASE_URL: &str = "http://192.168.86.32:11434";
const DEFAULT_MODEL: &str = "gpt-oss:20b";

#[derive(Debug, Serialize)]
pub struct GptOssStatus {
    pub state: String,
    pub model: String,
    pub base_url: String,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
    pub available_models: Option<Vec<String>>,
}

#[tauri::command]
pub async fn check_gpt_oss_status(
    base_url: Option<String>,
    model: Option<String>,
) -> Result<GptOssStatus, AppError> {
    let base_url = base_url
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
    let model = model
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|error| AppError::HttpRequest(error.to_string()))?;

    let started = Instant::now();
    let response = match client.get(format!("{}/api/tags", base_url)).send().await {
        Ok(response) => response,
        Err(error) => {
            return Ok(GptOssStatus {
                state: "disconnected".to_string(),
                model,
                base_url,
                latency_ms: Some(started.elapsed().as_millis() as u64),
                error: Some(error.to_string()),
                available_models: None,
            })
        }
    };

    let latency_ms = Some(started.elapsed().as_millis() as u64);
    let status = response.status();
    if !status.is_success() {
        return Ok(GptOssStatus {
            state: "disconnected".to_string(),
            model,
            base_url,
            latency_ms,
            error: Some(format!("HTTP {}", status)),
            available_models: None,
        });
    }

    let payload: Value = match response.json().await {
        Ok(payload) => payload,
        Err(error) => {
            return Ok(GptOssStatus {
                state: "disconnected".to_string(),
                model,
                base_url,
                latency_ms,
                error: Some(format!("Invalid JSON: {}", error)),
                available_models: None,
            })
        }
    };

    let available_models = match parse_models(&payload) {
        Ok(models) => models,
        Err(error) => {
            return Ok(GptOssStatus {
                state: "disconnected".to_string(),
                model,
                base_url,
                latency_ms,
                error: Some(error),
                available_models: None,
            })
        }
    };

    let state = if model_exists(&available_models, &model) {
        "connected"
    } else {
        "model_missing"
    };

    Ok(GptOssStatus {
        state: state.to_string(),
        model,
        base_url,
        latency_ms,
        error: None,
        available_models: Some(available_models),
    })
}

fn parse_models(payload: &Value) -> Result<Vec<String>, String> {
    let models = payload
        .get("models")
        .and_then(Value::as_array)
        .ok_or_else(|| "Malformed Ollama response: missing models array".to_string())?;

    Ok(models
        .iter()
        .filter_map(|item| {
            item.get("name")
                .or_else(|| item.get("model"))
                .and_then(Value::as_str)
                .map(|value| value.to_string())
        })
        .collect())
}

fn model_exists(available_models: &[String], target_model: &str) -> bool {
    available_models.iter().any(|candidate| {
        let candidate_lower = candidate.to_ascii_lowercase();
        let target_lower = target_model.to_ascii_lowercase();
        candidate_lower == target_lower
            || candidate_lower.starts_with(&format!("{}:", target_lower))
    })
}

#[cfg(test)]
mod tests {
    use super::{model_exists, parse_models};

    #[test]
    fn parse_models_returns_names() {
        let payload = serde_json::json!({
            "models": [
                {"name": "gpt-oss:20b"},
                {"model": "llama3.1"}
            ]
        });
        let models = parse_models(&payload).expect("models should parse");
        assert_eq!(models, vec!["gpt-oss:20b".to_string(), "llama3.1".to_string()]);
    }

    #[test]
    fn parse_models_fails_on_malformed_payload() {
        let payload = serde_json::json!({"unexpected": []});
        let error = parse_models(&payload).expect_err("expected parse failure");
        assert!(error.contains("missing models array"));
    }

    #[test]
    fn model_exists_supports_exact_and_prefixed_matches() {
        let models = vec![
            "gpt-oss:20b".to_string(),
            "gpt-oss:20b:q4_k_m".to_string(),
            "llama3.1".to_string(),
        ];
        assert!(model_exists(&models, "gpt-oss:20b"));
        assert!(model_exists(&models, "gpt-oss"));
        assert!(!model_exists(&models, "claude-sonnet-4"));
    }
}
