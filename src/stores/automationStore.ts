import { create } from "zustand";
import type {
  AutomationRun,
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
  schedules: AutomationSchedule[];
  scheduleRuns: AutomationScheduleRun[];
  loading: boolean;
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

export const useAutomationStore = create<AutomationStore>((set, get) => ({
  enabled: false,
  watches: [],
  runs: [],
  schedules: [],
  scheduleRuns: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const [enabled, watches, runs, schedules, scheduleRuns] = await Promise.all([
        api.getAutomationRunnerEnabled(),
        api.listWatches(),
        api.listAutomationRuns({ limit: 25 }),
        api.listSchedules(),
        api.listScheduleRuns({ limit: 25 }),
      ]);
      set({ enabled, watches, runs, schedules, scheduleRuns, loading: false });
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
      workflow_id: input.workflowId,
      watch_path: input.watchPath,
      recursive: input.recursive,
      file_glob: input.fileGlob,
      debounce_ms: 1200,
      stability_ms: 2000,
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
      workflow_id: input.workflowId,
      cadence: input.cadence,
      hourly_interval: input.hourlyInterval,
      weekly_days: input.weeklyDays,
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
