use async_trait::async_trait;
use std::collections::HashMap;
use tokio::process::Command;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};

pub struct CodeJsExecutor;

#[async_trait]
impl NodeExecutor for CodeJsExecutor {
    fn node_type(&self) -> &str {
        "code_js"
    }

    fn input_types(&self) -> Vec<(&str, &str)> {
        vec![("input", "any")]
    }

    fn output_types(&self) -> Vec<(&str, &str)> {
        vec![("output", "any")]
    }

    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String> {
        let config = match ctx.inputs.get("_config") {
            Some(NodeData::Json(c)) => c.clone(),
            _ => serde_json::Value::Object(serde_json::Map::new()),
        };

        let code = config
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("return input;")
            .to_string();

        let timeout_secs = config
            .get("timeout")
            .and_then(|v| v.as_u64())
            .unwrap_or(10);

        // Serialize input data for the JS script
        let input_data = match ctx.inputs.get("input") {
            Some(NodeData::Text(t)) => serde_json::Value::String(t.clone()),
            Some(NodeData::Json(j)) => j.clone(),
            _ => serde_json::Value::Null,
        };

        let input_json = serde_json::to_string(&input_data)
            .map_err(|e| format!("Failed to serialize input: {}", e))?;

        // Build JS wrapper script
        let js_script = format!(
            r#"
const input = JSON.parse({input_json});
const userFn = new Function('input', {user_code});
const result = userFn(input);
if (result !== undefined && result !== null) {{
    process.stdout.write(JSON.stringify(result));
}} else {{
    process.stdout.write('null');
}}
"#,
            input_json = serde_json::to_string(&input_json).unwrap(),
            user_code = serde_json::to_string(&code).unwrap(),
        );

        // Write temp file
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("synapse_code_{}.mjs", uuid::Uuid::new_v4()));
        tokio::fs::write(&temp_file, &js_script)
            .await
            .map_err(|e| format!("Failed to write temp file: {}", e))?;

        // Execute with timeout
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            Command::new("node")
                .arg("--no-warnings")
                .arg(&temp_file)
                .output(),
        )
        .await;

        // Cleanup temp file
        let _ = tokio::fs::remove_file(&temp_file).await;

        match result {
            Ok(Ok(output)) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("JavaScript error: {}", stderr));
                }
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();

                // Try to parse as JSON
                let node_data = match serde_json::from_str::<serde_json::Value>(&stdout) {
                    Ok(json) => NodeData::Json(json),
                    Err(_) => NodeData::Text(stdout),
                };

                let mut out = HashMap::new();
                out.insert("output".to_string(), node_data);
                Ok(out)
            }
            Ok(Err(e)) => Err(format!("Failed to execute node: {}", e)),
            Err(_) => Err(format!(
                "Code execution timed out after {}s",
                timeout_secs
            )),
        }
    }
}
