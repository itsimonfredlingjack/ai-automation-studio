import { beforeEach, describe, expect, it, vi } from "vitest";

const { api } = vi.hoisted(() => ({
  api: {
    getAutomationRunnerEnabled: vi.fn(),
    listWatches: vi.fn(),
    listAutomationRuns: vi.fn(),
    listSchedules: vi.fn(),
    listScheduleRuns: vi.fn(),
    setAutomationRunnerEnabled: vi.fn(),
    createWatch: vi.fn(),
    toggleWatch: vi.fn(),
    deleteWatch: vi.fn(),
    createSchedule: vi.fn(),
    toggleSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runWatchNow: vi.fn(),
    getLastFailedRun: vi.fn(),
  },
}));

vi.mock("@/lib/tauri", () => api);

import { useAutomationStore } from "@/stores/automationStore";

describe("automationStore command payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAutomationRunnerEnabled.mockResolvedValue(false);
    api.listWatches.mockResolvedValue([]);
    api.listAutomationRuns.mockResolvedValue([]);
    api.listSchedules.mockResolvedValue([]);
    api.listScheduleRuns.mockResolvedValue([]);
    api.createWatch.mockResolvedValue({});
    api.createSchedule.mockResolvedValue({});
  });

  it("sends camelCase args when creating a watch", async () => {
    await useAutomationStore.getState().createWatch({
      workflowId: "workflow-1",
      watchPath: "/tmp/inbox",
      recursive: true,
      fileGlob: "*.pdf",
    });

    expect(api.createWatch).toHaveBeenCalledWith({
      workflowId: "workflow-1",
      watchPath: "/tmp/inbox",
      recursive: true,
      fileGlob: "*.pdf",
      debounceMs: 1200,
      stabilityMs: 2000,
    });
  });

  it("sends camelCase args when creating a schedule", async () => {
    await useAutomationStore.getState().createSchedule({
      workflowId: "workflow-1",
      cadence: "weekly",
      weeklyDays: ["mon", "wed"],
      hour: 9,
      minute: 30,
    });

    expect(api.createSchedule).toHaveBeenCalledWith({
      workflowId: "workflow-1",
      cadence: "weekly",
      hourlyInterval: undefined,
      weeklyDays: ["mon", "wed"],
      hour: 9,
      minute: 30,
    });
  });
});
