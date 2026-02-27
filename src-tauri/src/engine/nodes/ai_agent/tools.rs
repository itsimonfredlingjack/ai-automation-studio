use crate::engine::nodes::ai_agent::analytics::AnalyticsTracker;
use crate::engine::nodes::ai_agent::config::AgentConfig;
use chrono::Utc;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;
const OUTPUT_CAP_BYTES: usize = 262_144;
#[derive(Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}
#[derive(Debug, Clone)]
pub struct ToolRuntime {
    source_path: PathBuf,
    source_dir: PathBuf,
    pub processed_dir: PathBuf,
}
impl ToolRuntime {
    pub fn new(config: &AgentConfig, globals: Option<&Value>) -> Result<Self, String> {
        let source_path = globals
            .and_then(|value| value.get("trigger_file_path"))
            .and_then(Value::as_str)
            .map(PathBuf::from)
            .or_else(|| config.source_path.as_ref().map(PathBuf::from))
            .ok_or_else(|| "tool_mode requires trigger_file_path or source_path".to_string())?;
        let source_path = std::fs::canonicalize(&source_path).map_err(|err| err.to_string())?;
        let source_dir = source_path
            .parent()
            .ok_or_else(|| "source file has no parent directory".to_string())?
            .to_path_buf();
        Ok(Self {
            processed_dir: source_dir.join("_processed"),
            source_path,
            source_dir,
        })
    }

    fn resolve_path(&self, value: &str) -> Result<PathBuf, String> {
        if value.trim().is_empty() {
            return Err("path cannot be empty".to_string());
        }
        let candidate = PathBuf::from(value);
        let target = if candidate.is_absolute() {
            candidate
        } else {
            self.source_dir.join(candidate)
        };
        Ok(target)
    }

    fn assert_in_scope(&self, path: &Path) -> Result<(), String> {
        if path.starts_with(&self.source_dir) {
            return Ok(());
        }
        Err(format!("path outside allowed scope: {}", path.display()))
    }
}
pub fn openai_tools_schema() -> Vec<Value> {
    ["extract_pdf_text", "read_text_file", "write_text_file", "write_json_file", "ensure_dir"]
        .into_iter()
        .map(|name| {
            json!({"type":"function","function":{"name":name,"description":"Document pipeline tool","parameters":{"type":"object","properties":{},"additionalProperties":true}}})
        })
        .collect()
}
pub fn anthropic_tools_schema() -> Vec<Value> {
    ["extract_pdf_text", "read_text_file", "write_text_file", "write_json_file", "ensure_dir"]
        .into_iter()
        .map(|name| {
            json!({"name":name,"description":"Document pipeline tool","input_schema":{"type":"object","properties":{},"additionalProperties":true}})
        })
        .collect()
}
pub async fn execute_tool_call(
    call: &ToolCall,
    runtime: &ToolRuntime,
    tracker: &AnalyticsTracker,
) -> Value {
    tracker.track("agent_tool_call_requested", json!({"tool_name": call.name, "tool_call_id": call.id}));
    let result = timeout(Duration::from_secs(60), execute_inner(call, runtime)).await;
    match result {
        Ok(Ok(output)) => {
            tracker.track("agent_tool_call_executed", json!({"tool_name": call.name, "tool_call_id": call.id}));
            json!({"ok": true, "tool": call.name, "output": output})
        }
        Ok(Err(error)) => {
            tracker.track("agent_tool_call_failed", json!({"tool_name": call.name, "tool_call_id": call.id, "error": error}));
            json!({"ok": false, "tool": call.name, "error": error})
        }
        Err(_) => {
            tracker.track("agent_tool_call_failed", json!({"tool_name": call.name, "tool_call_id": call.id, "error": "tool timeout"}));
            json!({"ok": false, "tool": call.name, "error": "tool timeout"})
        }
    }
}
pub fn validate_output_contract(runtime: &ToolRuntime, config: &AgentConfig, tool_calls: usize) -> Result<(), String> {
    if config.processed_output_mode != "sibling_processed" {
        return Err("unsupported processed_output_mode".to_string());
    }
    let stem = runtime
        .source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid source filename".to_string())?;
    let summary_path = runtime.processed_dir.join(format!("{stem}.summary.md"));
    let meta_path = runtime.processed_dir.join(format!("{stem}.meta.json"));
    if !summary_path.exists() || !meta_path.exists() {
        return Err("doc pipeline missing required .summary.md/.meta.json outputs".to_string());
    }
    let meta = std::fs::read_to_string(meta_path).map_err(|err| err.to_string())?;
    let parsed: Value = serde_json::from_str(&meta).map_err(|err| err.to_string())?;
    for field in ["source_path", "processed_at", "provider", "model", "tool_calls_count", "status"] {
        if parsed.get(field).is_none() {
            return Err(format!("meta.json missing field: {}", field));
        }
    }
    if parsed.get("tool_calls_count").and_then(Value::as_u64).unwrap_or_default() < tool_calls as u64 {
        return Err("meta.json tool_calls_count is inconsistent".to_string());
    }
    Ok(())
}
async fn execute_inner(call: &ToolCall, runtime: &ToolRuntime) -> Result<Value, String> {
    match call.name.as_str() {
        "extract_pdf_text" => extract_pdf_text(call, runtime).await,
        "read_text_file" => read_text_file(call, runtime),
        "write_text_file" => write_text_file(call, runtime),
        "write_json_file" => write_json_file(call, runtime),
        "ensure_dir" => ensure_dir(call, runtime),
        _ => Err(format!("tool not allowed: {}", call.name)),
    }
}
async fn extract_pdf_text(call: &ToolCall, runtime: &ToolRuntime) -> Result<Value, String> {
    let source = call.arguments.get("source_path").and_then(Value::as_str).unwrap_or(runtime.source_path.to_str().unwrap_or_default());
    let path = std::fs::canonicalize(runtime.resolve_path(source)?).map_err(|err| err.to_string())?;
    runtime.assert_in_scope(&path)?;
    let output = Command::new("pdftotext").arg(&path).arg("-").output().await.map_err(|err| err.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let text = truncate_utf8(&String::from_utf8_lossy(&output.stdout));
    Ok(json!({"path": path, "text": text}))
}
fn read_text_file(call: &ToolCall, runtime: &ToolRuntime) -> Result<Value, String> {
    let path = call.arguments.get("path").and_then(Value::as_str).ok_or_else(|| "path is required".to_string())?;
    let path = std::fs::canonicalize(runtime.resolve_path(path)?).map_err(|err| err.to_string())?;
    runtime.assert_in_scope(&path)?;
    Ok(json!({"path": path, "text": truncate_utf8(&std::fs::read_to_string(path).map_err(|err| err.to_string())?)}))
}
fn write_text_file(call: &ToolCall, runtime: &ToolRuntime) -> Result<Value, String> {
    let path = call.arguments.get("path").and_then(Value::as_str).ok_or_else(|| "path is required".to_string())?;
    let content = call.arguments.get("content").and_then(Value::as_str).ok_or_else(|| "content is required".to_string())?;
    let path = runtime.resolve_path(path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        runtime.assert_in_scope(&std::fs::canonicalize(parent).map_err(|err| err.to_string())?)?;
    }
    if path.exists() {
        runtime.assert_in_scope(&std::fs::canonicalize(&path).map_err(|err| err.to_string())?)?;
    }
    std::fs::write(&path, content).map_err(|err| err.to_string())?;
    Ok(json!({"path": path, "bytes_written": content.len()}))
}
fn write_json_file(call: &ToolCall, runtime: &ToolRuntime) -> Result<Value, String> {
    let path = call.arguments.get("path").and_then(Value::as_str).ok_or_else(|| "path is required".to_string())?;
    let data = call.arguments.get("json").cloned().ok_or_else(|| "json is required".to_string())?;
    let path = runtime.resolve_path(path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        runtime.assert_in_scope(&std::fs::canonicalize(parent).map_err(|err| err.to_string())?)?;
    }
    if path.exists() {
        runtime.assert_in_scope(&std::fs::canonicalize(&path).map_err(|err| err.to_string())?)?;
    }
    let body = serde_json::to_string_pretty(&data).map_err(|err| err.to_string())?;
    std::fs::write(&path, body).map_err(|err| err.to_string())?;
    Ok(json!({"path": path}))
}
fn ensure_dir(call: &ToolCall, runtime: &ToolRuntime) -> Result<Value, String> {
    let path = call.arguments.get("path").and_then(Value::as_str).ok_or_else(|| "path is required".to_string())?;
    let path = runtime.resolve_path(path)?;
    runtime.assert_in_scope(&path)?;
    std::fs::create_dir_all(&path).map_err(|err| err.to_string())?;
    Ok(json!({"path": path, "created_at": Utc::now()}))
}
fn truncate_utf8(value: &str) -> String {
    value.chars().take(OUTPUT_CAP_BYTES / 2).collect()
}
