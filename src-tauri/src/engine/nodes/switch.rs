use async_trait::async_trait;
use std::collections::HashMap;

use crate::engine::executor::{ExecutionContext, NodeData, NodeExecutor};

pub struct SwitchExecutor;

#[async_trait]
impl NodeExecutor for SwitchExecutor {
    fn node_type(&self) -> &str {
        "switch"
    }

    fn input_types(&self) -> Vec<(&str, &str)> {
        vec![("input", "any")]
    }

    fn output_types(&self) -> Vec<(&str, &str)> {
        vec![("default", "any")]
    }

    async fn execute(
        &self,
        ctx: ExecutionContext,
    ) -> Result<HashMap<String, NodeData>, String> {
        let config = match ctx.inputs.get("_config") {
            Some(NodeData::Json(c)) => c.clone(),
            _ => serde_json::Value::Object(serde_json::Map::new()),
        };

        let input = match ctx.inputs.get("input") {
            Some(NodeData::Text(t)) => t.clone(),
            Some(NodeData::Json(j)) => serde_json::to_string(j).unwrap_or_default(),
            _ => String::new(),
        };

        let conditions = config
            .get("conditions")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let input_data = ctx.inputs.get("input").cloned().unwrap_or(NodeData::Empty);

        // Evaluate conditions in order, first match wins
        for condition in &conditions {
            let operator = condition
                .get("operator")
                .and_then(|v| v.as_str())
                .unwrap_or("equals");
            let value = condition
                .get("value")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let output_handle = condition
                .get("output_handle")
                .and_then(|v| v.as_str())
                .unwrap_or("output_0");

            let matches = evaluate_condition(&input, operator, value);

            if matches {
                let mut out = HashMap::new();
                out.insert(output_handle.to_string(), input_data);
                return Ok(out);
            }
        }

        // No condition matched — route to default
        let mut out = HashMap::new();
        out.insert("default".to_string(), input_data);
        Ok(out)
    }
}

fn evaluate_condition(input: &str, operator: &str, value: &str) -> bool {
    match operator {
        "contains" => input.contains(value),
        "not_contains" => !input.contains(value),
        "equals" => input == value,
        "not_equals" => input != value,
        "starts_with" => input.starts_with(value),
        "ends_with" => input.ends_with(value),
        "greater_than" => {
            input.parse::<f64>().ok().zip(value.parse::<f64>().ok())
                .map(|(a, b)| a > b)
                .unwrap_or(false)
        }
        "less_than" => {
            input.parse::<f64>().ok().zip(value.parse::<f64>().ok())
                .map(|(a, b)| a < b)
                .unwrap_or(false)
        }
        "regex" => regex::Regex::new(value)
            .map(|re| re.is_match(input))
            .unwrap_or(false),
        "is_empty" => input.is_empty(),
        "is_not_empty" => !input.is_empty(),
        _ => false,
    }
}
