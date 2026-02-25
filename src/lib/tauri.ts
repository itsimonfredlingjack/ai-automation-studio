import { invoke } from "@tauri-apps/api/core";
import type { Workflow, WorkflowMetadata } from "@/types/workflow";

export async function saveWorkflow(workflow: Workflow): Promise<void> {
  return invoke("save_workflow", { workflow });
}

export async function loadWorkflow(id: string): Promise<Workflow> {
  return invoke("load_workflow", { id });
}

export async function listWorkflows(): Promise<WorkflowMetadata[]> {
  return invoke("list_workflows");
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  return invoke("delete_workflow", { id });
}

export async function executeWorkflow(
  id: string
): Promise<Record<string, unknown>> {
  return invoke("execute_workflow", { id });
}

export interface StepResult {
  node_id: string;
  node_type: string;
  outputs: Record<string, unknown>;
  duration_ms: number;
}

export interface ExecutionOutput {
  final_outputs: Record<string, unknown>;
  steps: StepResult[];
  total_duration_ms: number;
}

export async function executeWorkflowDebug(
  id: string
): Promise<ExecutionOutput> {
  return invoke("execute_workflow_debug", { id });
}

// Webhook management
export interface WebhookInfo {
  workflow_id: string;
  port: number;
  url: string;
}

export async function startWebhook(
  workflowId: string,
  port: number
): Promise<string> {
  return invoke("start_webhook", { workflowId, port });
}

export async function stopWebhook(workflowId: string): Promise<void> {
  return invoke("stop_webhook", { workflowId });
}

export async function listWebhooks(): Promise<WebhookInfo[]> {
  return invoke("list_webhooks");
}
