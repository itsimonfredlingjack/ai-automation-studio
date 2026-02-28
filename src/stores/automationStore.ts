import { create } from "zustand";
import type {
  AutomationHealthSnapshot,
  AutomationRun,
  RuntimeAlert,
  RecentRunItem,
  AutomationSchedule,
  AutomationScheduleRun,
  AutomationWatch,
  ScheduleCadence,
  ScheduleStatus,
  WatchStatus,
} from "@/types/automation";
import * as api from "@/lib/tauri";

interface CreateWatchInput {
  workflowId: string;
  watchPath: string;
  recursive: boolean;
  fileGlob: string;
}

interface CreateScheduleInput {
  workflowId: string;
  cadence: ScheduleCadence;
  hourlyInterval?: number;
  weeklyDays?: string[];
  hour?: number;
  minute?: number;
}

interface AutomationStore {
  enabled: boolean;
  watches: AutomationWatch[];
  runs: AutomationRun[];
  alerts: RuntimeAlert[];
  schedules: AutomationSchedule[];
  scheduleRuns: AutomationScheduleRun[];
  loading: boolean;
  getSortedWatches: () => AutomationWatch[];
  getRuns24h: () => AutomationRun[];
  getHealthSnapshot: () => AutomationHealthSnapshot;
  getRecentRuns: (limit?: number) => RecentRunItem[];
  getRecentAlerts: (limit?: number) => RuntimeAlert[];
  fetchAll: () => Promise<void>;
  setRunnerEnabled: (enabled: boolean) => Promise<void>;
  createWatch: (input: CreateWatchInput) => Promise<void>;
  toggleWatch: (id: string, status: WatchStatus) => Promise<void>;
  deleteWatch: (id: string) => Promise<void>;
  createSchedule: (input: CreateScheduleInput) => Promise<void>;
  toggleSchedule: (id: string, status: ScheduleStatus) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  runWatchNow: (id: string) => Promise<AutomationRun>;
  getLastFailedRun: (id: string) => Promise<AutomationRun | null>;
}

const RUN_WINDOW_MS = 24 * 60 * 60 * 1000;

const WATCH_STATUS_ORDER: Record<WatchStatus, number> = {
  active: 0,
  paused: 1,
  disabled: 2,
};

function toTimestamp(value: string): number {
  return new Date(value).getTime();
}

function getFileName(path: string): string {
  const normalizedPath = path.replaceAll("\\", "/");
  const parts = normalizedPath.split("/");
  const lastPart = parts[parts.length - 1];
  return lastPart ?? path;
}

export function sortWatchesForDisplay(
  watches: AutomationWatch[]
): AutomationWatch[] {
  return [...watches].sort((left, right) => {
    const statusDiff =
      WATCH_STATUS_ORDER[left.status] - WATCH_STATUS_ORDER[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return toTimestamp(right.updated_at) - toTimestamp(left.updated_at);
  });
}

export function getRunsInLast24Hours(
  runs: AutomationRun[],
  now: number = Date.now()
): AutomationRun[] {
  return runs.filter((run) => {
    const endedAt = toTimestamp(run.ended_at);
    if (Number.isNaN(endedAt)) {
      return false;
    }
    return now - endedAt <= RUN_WINDOW_MS;
  });
}

export function buildAutomationHealthSnapshot(
  watches: AutomationWatch[],
  runs: AutomationRun[],
  now: number = Date.now()
): AutomationHealthSnapshot {
  const runs24h = getRunsInLast24Hours(runs, now);
  return {
    active_watches: watches.filter((watch) => watch.status === "active").length,
    paused_watches: watches.filter((watch) => watch.status === "paused").length,
    disabled_watches: watches.filter((watch) => watch.status === "disabled")
      .length,
    successful_runs_24h: runs24h.filter((run) => run.status === "success")
      .length,
    failed_runs_24h: runs24h.filter((run) => run.status === "error").length,
  };
}

export function toRecentRunItems(
  runs: AutomationRun[],
  limit: number = 8
): RecentRunItem[] {
  return [...runs]
    .sort((left, right) => toTimestamp(right.ended_at) - toTimestamp(left.ended_at))
    .slice(0, limit)
    .map((run) => ({
      id: run.id,
      watch_id: run.watch_id,
      workflow_id: run.workflow_id,
      status: run.status,
      duration_ms: run.duration_ms,
      trigger_file_path: run.trigger_file_path,
      trigger_file_name: getFileName(run.trigger_file_path),
      ended_at: run.ended_at,
      result_summary: run.result_summary,
      error_message: run.error_message,
    }));
}

export function toRecentAlerts(
  alerts: RuntimeAlert[],
  limit: number = 5
): RuntimeAlert[] {
  return [...alerts]
    .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at))
    .slice(0, limit);
}

export const useAutomationStore = create<AutomationStore>((set, get) => ({
  enabled: false,
  watches: [],
  runs: [],
  alerts: [],
  schedules: [],
  scheduleRuns: [],
  loading: false,

  getSortedWatches: () => sortWatchesForDisplay(get().watches),

  getRuns24h: () => getRunsInLast24Hours(get().runs),

  getHealthSnapshot: () =>
    buildAutomationHealthSnapshot(get().watches, get().runs),

  getRecentRuns: (limit: number = 8) => toRecentRunItems(get().runs, limit),

  getRecentAlerts: (limit: number = 5) => toRecentAlerts(get().alerts, limit),

  fetchAll: async () => {
    set({ loading: true });
    try {
      const [enabled, watches, runs, alerts, schedules, scheduleRuns] = await Promise.all([
        api.getAutomationRunnerEnabled(),
        api.listWatches(),
        api.listAutomationRuns({ limit: 25 }),
        api.listRuntimeAlerts(20),
        api.listSchedules(),
        api.listScheduleRuns({ limit: 25 }),
      ]);
      set({ enabled, watches, runs, alerts, schedules, scheduleRuns, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setRunnerEnabled: async (enabled: boolean) => {
    await api.setAutomationRunnerEnabled(enabled);
    await get().fetchAll();
  },

  createWatch: async (input: CreateWatchInput) => {
    await api.createWatch({
      workflowId: input.workflowId,
      watchPath: input.watchPath,
      recursive: input.recursive,
      fileGlob: input.fileGlob,
      debounceMs: 1200,
      stabilityMs: 2000,
    });
    await get().fetchAll();
  },

  toggleWatch: async (id: string, status: WatchStatus) => {
    await api.toggleWatch(id, status);
    await get().fetchAll();
  },

  deleteWatch: async (id: string) => {
    await api.deleteWatch(id);
    await get().fetchAll();
  },

  createSchedule: async (input: CreateScheduleInput) => {
    await api.createSchedule({
      workflowId: input.workflowId,
      cadence: input.cadence,
      hourlyInterval: input.hourlyInterval,
      weeklyDays: input.weeklyDays,
      hour: input.hour,
      minute: input.minute,
    });
    await get().fetchAll();
  },

  toggleSchedule: async (id: string, status: ScheduleStatus) => {
    await api.toggleSchedule(id, status);
    await get().fetchAll();
  },

  deleteSchedule: async (id: string) => {
    await api.deleteSchedule(id);
    await get().fetchAll();
  },

  runWatchNow: async (id: string) => {
    const run = await api.runWatchNow(id);
    await get().fetchAll();
    return run;
  },

  getLastFailedRun: async (id: string) => {
    return api.getLastFailedRun(id);
  },
}));
