import { invoke } from "@tauri-apps/api/core";
import type { Workflow, WorkflowMetadata } from "@/types/workflow";
import type {
  AutomationRun,
  AutomationSchedule,
  AutomationScheduleRun,
  AutomationWatch,
  ScheduleCadence,
  ScheduleStatus,
  WatchStatus,
} from "@/types/automation";
import type { GptOssStatus } from "@/types/aiSystem";

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

export async function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  return invoke("track_event", { eventName, properties });
}

export async function listWatches(): Promise<AutomationWatch[]> {
  return invoke("list_watches");
}

export async function createWatch(params: {
  workflow_id: string;
  watch_path: string;
  recursive: boolean;
  file_glob: string;
  debounce_ms?: number;
  stability_ms?: number;
}): Promise<AutomationWatch> {
  return invoke("create_watch", params);
}

export async function updateWatch(params: {
  id: string;
  watch_path?: string;
  recursive?: boolean;
  file_glob?: string;
  debounce_ms?: number;
  stability_ms?: number;
}): Promise<AutomationWatch> {
  return invoke("update_watch", params);
}

export async function toggleWatch(
  id: string,
  status: WatchStatus
): Promise<AutomationWatch> {
  return invoke("toggle_watch", { id, status });
}

export async function deleteWatch(id: string): Promise<boolean> {
  return invoke("delete_watch", { id });
}

export async function listAutomationRuns(params: {
  watch_id?: string;
  workflow_id?: string;
  limit?: number;
  cursor?: number;
} = {}): Promise<AutomationRun[]> {
  return invoke("list_automation_runs", params);
}

export async function getAutomationRunnerEnabled(): Promise<boolean> {
  return invoke("get_automation_runner_enabled");
}

export async function setAutomationRunnerEnabled(
  enabled: boolean
): Promise<boolean> {
  return invoke("set_automation_runner_enabled", { enabled });
}

export async function listSchedules(): Promise<AutomationSchedule[]> {
  return invoke("list_schedules");
}

export async function createSchedule(params: {
  workflow_id: string;
  cadence: ScheduleCadence;
  hourly_interval?: number;
  weekly_days?: string[];
  hour?: number;
  minute?: number;
}): Promise<AutomationSchedule> {
  return invoke("create_schedule", params);
}

export async function toggleSchedule(
  id: string,
  status: ScheduleStatus
): Promise<AutomationSchedule> {
  return invoke("toggle_schedule", { id, status });
}

export async function deleteSchedule(id: string): Promise<boolean> {
  return invoke("delete_schedule", { id });
}

export async function listScheduleRuns(params: {
  schedule_id?: string;
  workflow_id?: string;
  limit?: number;
  cursor?: number;
} = {}): Promise<AutomationScheduleRun[]> {
  return invoke("list_schedule_runs", params);
}

export async function runWatchNow(watch_id: string): Promise<AutomationRun> {
  return invoke("run_watch_now", { watchId: watch_id });
}

export async function getLastFailedRun(
  watch_id: string
): Promise<AutomationRun | null> {
  return invoke("get_last_failed_run", { watchId: watch_id });
}

export async function checkGptOssStatus(params: {
  base_url?: string;
  model?: string;
} = {}): Promise<GptOssStatus> {
  return invoke("check_gpt_oss_status", params);
}
