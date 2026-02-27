pub mod executor;
pub mod nodes;

use crate::models::workflow::Workflow;
use executor::{ExecutionContext, NodeData, NodeRegistry};
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, Serialize)]
pub struct StepResult {
    pub node_id: String,
    pub node_type: String,
    pub outputs: HashMap<String, NodeData>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionOutput {
    pub final_outputs: HashMap<String, NodeData>,
    pub steps: Vec<StepResult>,
    pub total_duration_ms: u64,
}

pub struct DagEngine {
    registry: NodeRegistry,
}

impl Default for DagEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl DagEngine {
    pub fn new() -> Self {
        Self {
            registry: NodeRegistry::new(),
        }
    }

    /// Topological sort using Kahn's algorithm
    fn topological_sort(&self, workflow: &Workflow) -> Result<Vec<String>, String> {
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();

        for node in &workflow.nodes {
            in_degree.entry(node.id.clone()).or_insert(0);
            adjacency.entry(node.id.clone()).or_default();
        }

        for edge in &workflow.edges {
            *in_degree.entry(edge.target.clone()).or_insert(0) += 1;
            adjacency
                .entry(edge.source.clone())
                .or_default()
                .push(edge.target.clone());
        }

        let mut queue: VecDeque<String> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(id, _)| id.clone())
            .collect();

        let mut sorted = Vec::new();

        while let Some(node_id) = queue.pop_front() {
            sorted.push(node_id.clone());
            if let Some(neighbors) = adjacency.get(&node_id) {
                for neighbor in neighbors {
                    if let Some(deg) = in_degree.get_mut(neighbor) {
                        *deg -= 1;
                        if *deg == 0 {
                            queue.push_back(neighbor.clone());
                        }
                    }
                }
            }
        }

        if sorted.len() != workflow.nodes.len() {
            return Err("Workflow contains a cycle".to_string());
        }

        Ok(sorted)
    }

    /// Gather inputs for a node from upstream outputs
    fn gather_inputs(
        &self,
        node_id: &str,
        node_data: &serde_json::Value,
        workflow: &Workflow,
        outputs: &HashMap<String, HashMap<String, NodeData>>,
        skipped: &HashSet<String>,
        globals: Option<&Value>,
    ) -> (HashMap<String, NodeData>, bool) {
        let mut inputs = HashMap::new();
        inputs.insert("_config".to_string(), NodeData::Json(node_data.clone()));
        if let Some(globals_json) = globals {
            inputs.insert("_globals".to_string(), NodeData::Json(globals_json.clone()));
        }

        let incoming_edges: Vec<_> = workflow
            .edges
            .iter()
            .filter(|e| e.target == node_id)
            .collect();

        // Check if this node should be skipped (all incoming edges from skipped/inactive sources)
        if !incoming_edges.is_empty() {
            let mut all_inactive = true;
            for edge in &incoming_edges {
                if skipped.contains(&edge.source) {
                    continue;
                }
                if let Some(source_outputs) = outputs.get(&edge.source) {
                    let handle = edge.source_handle.as_deref().unwrap_or("output");
                    if source_outputs.contains_key(handle) {
                        all_inactive = false;
                        let data = source_outputs.get(handle).unwrap();
                        let input_handle = edge.target_handle.as_deref().unwrap_or("input");
                        inputs.insert(input_handle.to_string(), data.clone());
                    }
                }
            }
            if all_inactive {
                return (inputs, true); // should skip
            }
        }

        // Gather remaining inputs normally
        for edge in &incoming_edges {
            if skipped.contains(&edge.source) {
                continue;
            }
            if let Some(source_outputs) = outputs.get(&edge.source) {
                let handle = edge.source_handle.as_deref().unwrap_or("output");
                if let Some(data) = source_outputs.get(handle) {
                    let input_handle = edge.target_handle.as_deref().unwrap_or("input");
                    inputs.entry(input_handle.to_string()).or_insert_with(|| data.clone());
                }
            }
        }

        (inputs, false)
    }

    /// Execute a workflow DAG
    pub async fn execute(
        &self,
        workflow: &Workflow,
    ) -> Result<HashMap<String, NodeData>, String> {
        let result = self.execute_debug(workflow, None).await?;
        Ok(result.final_outputs)
    }

    /// Execute a workflow DAG with step-by-step debug info
    pub async fn execute_debug(
        &self,
        workflow: &Workflow,
        extra_inputs: Option<HashMap<String, HashMap<String, NodeData>>>,
    ) -> Result<ExecutionOutput, String> {
        self.execute_debug_with_globals(workflow, extra_inputs, None)
            .await
    }

    pub async fn execute_debug_with_globals(
        &self,
        workflow: &Workflow,
        extra_inputs: Option<HashMap<String, HashMap<String, NodeData>>>,
        globals: Option<Value>,
    ) -> Result<ExecutionOutput, String> {
        let total_start = std::time::Instant::now();
        let order = self.topological_sort(workflow)?;

        let node_map: HashMap<&str, &crate::models::workflow::WorkflowNode> =
            workflow.nodes.iter().map(|n| (n.id.as_str(), n)).collect();

        let mut outputs: HashMap<String, HashMap<String, NodeData>> = HashMap::new();
        let mut skipped: HashSet<String> = HashSet::new();
        let mut steps: Vec<StepResult> = Vec::new();

        for node_id in &order {
            let node = node_map
                .get(node_id.as_str())
                .ok_or_else(|| format!("Node {} not found", node_id))?;

            let executor = self
                .registry
                .get(&node.node_type)
                .ok_or_else(|| format!("No executor for node type: {}", node.node_type))?;

            let (mut inputs, should_skip) =
                self.gather_inputs(
                    node_id,
                    &node.data,
                    workflow,
                    &outputs,
                    &skipped,
                    globals.as_ref(),
                );

            // Merge extra inputs (e.g., webhook request data) for this node
            if let Some(ref extra) = extra_inputs {
                if let Some(node_extra) = extra.get(node_id) {
                    for (key, value) in node_extra {
                        inputs.insert(key.clone(), value.clone());
                    }
                }
            }

            if should_skip {
                skipped.insert(node_id.clone());
                let empty_outputs = HashMap::new();
                outputs.insert(node_id.clone(), empty_outputs.clone());
                steps.push(StepResult {
                    node_id: node_id.clone(),
                    node_type: node.node_type.clone(),
                    outputs: empty_outputs,
                    duration_ms: 0,
                });
                continue;
            }

            let ctx = ExecutionContext { inputs };
            let step_start = std::time::Instant::now();
            let result = executor.execute(ctx).await?;
            let duration_ms = step_start.elapsed().as_millis() as u64;

            steps.push(StepResult {
                node_id: node_id.clone(),
                node_type: node.node_type.clone(),
                outputs: result.clone(),
                duration_ms,
            });

            outputs.insert(node_id.clone(), result);
        }

        // Collect final outputs from terminal nodes
        let sources: HashSet<&str> =
            workflow.edges.iter().map(|e| e.source.as_str()).collect();
        let mut final_outputs = HashMap::new();
        for (node_id, node_outputs) in &outputs {
            if !sources.contains(node_id.as_str()) && !skipped.contains(node_id) {
                for (handle, data) in node_outputs {
                    final_outputs
                        .insert(format!("{}:{}", node_id, handle), data.clone());
                }
            }
        }

        Ok(ExecutionOutput {
            final_outputs,
            steps,
            total_duration_ms: total_start.elapsed().as_millis() as u64,
        })
    }
}
