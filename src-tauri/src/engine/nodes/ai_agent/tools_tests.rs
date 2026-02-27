use super::analytics::AnalyticsTracker;
use super::config::AgentConfig;
use super::tools::{execute_tool_call, validate_output_contract, ToolCall, ToolRuntime};
use serde_json::json;
use std::path::PathBuf;
use uuid::Uuid;

fn test_root() -> PathBuf {
    std::env::temp_dir().join(format!("synapse-tools-{}", Uuid::new_v4()))
}

fn build_config(source_path: &str) -> AgentConfig {
    AgentConfig {
        provider: "ollama".to_string(),
        api_key: String::new(),
        model: "gpt-oss:20b".to_string(),
        base_url: "http://localhost:11434".to_string(),
        system_message: String::new(),
        temperature: 0.7,
        tool_mode: true,
        tool_profile: "doc_pipeline_v1".to_string(),
        max_tool_rounds: 4,
        processed_output_mode: "sibling_processed".to_string(),
        source_path: Some(source_path.to_string()),
    }
}

#[tokio::test]
async fn rejects_out_of_scope_reads() {
    let root = test_root();
    let source_dir = root.join("source");
    std::fs::create_dir_all(&source_dir).unwrap();
    let source_file = source_dir.join("a.pdf");
    std::fs::write(&source_file, "stub").unwrap();
    let runtime = ToolRuntime::new(&build_config(source_file.to_str().unwrap()), None).unwrap();
    let call = ToolCall {
        id: "1".to_string(),
        name: "read_text_file".to_string(),
        arguments: json!({"path": "/etc/hosts"}),
    };
    let result = execute_tool_call(&call, &runtime, &AnalyticsTracker::from_globals(None)).await;
    assert_eq!(result["ok"], false);
}

#[tokio::test]
async fn truncates_large_text_reads() {
    let root = test_root();
    let source_dir = root.join("source");
    std::fs::create_dir_all(&source_dir).unwrap();
    let source_file = source_dir.join("doc.pdf");
    let large_text = "a".repeat(400_000);
    std::fs::write(&source_file, "stub").unwrap();
    std::fs::write(source_dir.join("big.txt"), large_text).unwrap();
    let runtime = ToolRuntime::new(&build_config(source_file.to_str().unwrap()), None).unwrap();
    let call = ToolCall {
        id: "2".to_string(),
        name: "read_text_file".to_string(),
        arguments: json!({"path": "big.txt"}),
    };
    let result = execute_tool_call(&call, &runtime, &AnalyticsTracker::from_globals(None)).await;
    let text_len = result["output"]["text"].as_str().unwrap_or("").len();
    assert!(text_len <= 131_072);
}

#[test]
fn validates_output_contract_fields() {
    let root = test_root();
    let source_dir = root.join("source");
    let processed = source_dir.join("_processed");
    std::fs::create_dir_all(&processed).unwrap();
    let source_file = source_dir.join("invoice.pdf");
    std::fs::write(&source_file, "stub").unwrap();
    std::fs::write(processed.join("invoice.summary.md"), "summary").unwrap();
    std::fs::write(
        processed.join("invoice.meta.json"),
        json!({
            "source_path": source_file,
            "processed_at": "2026-01-01T00:00:00Z",
            "provider": "ollama",
            "model": "gpt-oss:20b",
            "tool_calls_count": 3,
            "status": "success"
        })
        .to_string(),
    )
    .unwrap();
    let config = build_config(source_file.to_str().unwrap());
    let runtime = ToolRuntime::new(&config, None).unwrap();
    assert!(validate_output_contract(&runtime, &config, 2).is_ok());
}

#[cfg(unix)]
#[tokio::test]
async fn rejects_symlink_escape() {
    let root = test_root();
    let source_dir = root.join("source");
    let outside_dir = root.join("outside");
    std::fs::create_dir_all(&source_dir).unwrap();
    std::fs::create_dir_all(&outside_dir).unwrap();
    let source_file = source_dir.join("src.pdf");
    std::fs::write(&source_file, "stub").unwrap();
    std::fs::write(outside_dir.join("secret.txt"), "secret").unwrap();
    std::os::unix::fs::symlink(outside_dir.join("secret.txt"), source_dir.join("link.txt")).unwrap();
    let runtime = ToolRuntime::new(&build_config(source_file.to_str().unwrap()), None).unwrap();
    let call = ToolCall {
        id: "3".to_string(),
        name: "read_text_file".to_string(),
        arguments: json!({"path": "link.txt"}),
    };
    let result = execute_tool_call(&call, &runtime, &AnalyticsTracker::from_globals(None)).await;
    assert_eq!(result["ok"], false);
}
