export type WatchStatus = "active" | "paused" | "disabled";
export type AutomationRunStatus = "success" | "error";
export type ScheduleCadence = "hourly" | "weekly";
export type ScheduleStatus = "active" | "paused" | "disabled";

export interface AutomationWatch {
  id: string;
  workflow_id: string;
  watch_path: string;
  recursive: boolean;
  file_glob: string;
  status: WatchStatus;
  debounce_ms: number;
  stability_ms: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  watch_id: string;
  workflow_id: string;
  trigger_file_path: string;
  trigger_event_id: string;
  status: AutomationRunStatus;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  error_message?: string;
}

export interface AutomationSchedule {
  id: string;
  workflow_id: string;
  cadence: ScheduleCadence;
  hourly_interval?: number;
  weekly_days: string[];
  hour: number;
  minute: number;
  status: ScheduleStatus;
  last_run_at?: string;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationScheduleRun {
  id: string;
  schedule_id: string;
  workflow_id: string;
  trigger_event_id: string;
  status: AutomationRunStatus;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  error_message?: string;
}
