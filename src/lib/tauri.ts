import { invoke } from "@tauri-apps/api/core";
import type { Workflow, WorkflowMetadata } from "@/types/workflow";
import type {
  AutomationRun,
  RuntimeAlert,
  AutomationSchedule,
  AutomationScheduleRun,
  AutomationWatch,
  ScheduleCadence,
  ScheduleStatus,
  WatchStatus,
} from "@/types/automation";
import type { GptOssStatus } from "@/types/aiSystem";

export interface FileSortPreview {
  matches: boolean;
  source_path: string;
  destination_dir: string;
  proposed_path: string;
  final_path: string;
  action: "move";
  conflict_resolution: "none" | "keep_both";
  reason?: string;
}

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
  port?: number
): Promise<WebhookInfo> {
  return invoke("start_webhook", { workflowId, port });
}

export async function stopWebhook(workflowId: string): Promise<void> {
  return invoke("stop_webhook", { workflowId });
}

export async function listWebhooks(): Promise<WebhookInfo[]> {
  return invoke("list_webhooks");
}

export async function listRuntimeAlerts(limit?: number): Promise<RuntimeAlert[]> {
  return invoke("list_runtime_alerts", { limit });
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
  workflowId: string;
  watchPath: string;
  recursive: boolean;
  fileGlob: string;
  debounceMs?: number;
  stabilityMs?: number;
}): Promise<AutomationWatch> {
  return invoke("create_watch", {
    workflowId: params.workflowId,
    watchPath: params.watchPath,
    recursive: params.recursive,
    fileGlob: params.fileGlob,
    debounceMs: params.debounceMs,
    stabilityMs: params.stabilityMs,
  });
}

export async function updateWatch(params: {
  id: string;
  watchPath?: string;
  recursive?: boolean;
  fileGlob?: string;
  debounceMs?: number;
  stabilityMs?: number;
}): Promise<AutomationWatch> {
  return invoke("update_watch", {
    id: params.id,
    watchPath: params.watchPath,
    recursive: params.recursive,
    fileGlob: params.fileGlob,
    debounceMs: params.debounceMs,
    stabilityMs: params.stabilityMs,
  });
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
  watchId?: string;
  workflowId?: string;
  limit?: number;
  cursor?: number;
} = {}): Promise<AutomationRun[]> {
  return invoke("list_automation_runs", {
    watchId: params.watchId,
    workflowId: params.workflowId,
    limit: params.limit,
    cursor: params.cursor,
  });
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
  workflowId: string;
  cadence: ScheduleCadence;
  hourlyInterval?: number;
  weeklyDays?: string[];
  hour?: number;
  minute?: number;
}): Promise<AutomationSchedule> {
  return invoke("create_schedule", {
    workflowId: params.workflowId,
    cadence: params.cadence,
    hourlyInterval: params.hourlyInterval,
    weeklyDays: params.weeklyDays,
    hour: params.hour,
    minute: params.minute,
  });
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
  scheduleId?: string;
  workflowId?: string;
  limit?: number;
  cursor?: number;
} = {}): Promise<AutomationScheduleRun[]> {
  return invoke("list_schedule_runs", {
    scheduleId: params.scheduleId,
    workflowId: params.workflowId,
    limit: params.limit,
    cursor: params.cursor,
  });
}

export async function runWatchNow(watch_id: string): Promise<AutomationRun> {
  return invoke("run_watch_now", { watchId: watch_id });
}

export async function getLastFailedRun(
  watch_id: string
): Promise<AutomationRun | null> {
  return invoke("get_last_failed_run", { watchId: watch_id });
}

export async function previewFileSortRule(params: {
  samplePath: string;
  watchPath: string;
  destinationPath: string;
  fileGlob: string;
  conflictPolicy: "keep_both";
}): Promise<FileSortPreview> {
  return invoke("preview_file_sort_rule", {
    samplePath: params.samplePath,
    watchPath: params.watchPath,
    destinationPath: params.destinationPath,
    fileGlob: params.fileGlob,
    conflictPolicy: params.conflictPolicy,
  });
}

export async function checkGptOssStatus(params: {
  base_url?: string;
  model?: string;
} = {}): Promise<GptOssStatus> {
  return invoke("check_gpt_oss_status", params);
}
