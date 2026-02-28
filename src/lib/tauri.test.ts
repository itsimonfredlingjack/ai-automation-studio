import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import {
  createSchedule,
  createWatch,
  listAutomationRuns,
  listScheduleRuns,
  previewFileSortRule,
  updateWatch,
} from "@/lib/tauri";

describe("tauri command payload mapping", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({});
  });

  it("maps createWatch payload to camelCase tauri args", async () => {
    await createWatch({
      workflowId: "workflow-1",
      watchPath: "/tmp/inbox",
      recursive: true,
      fileGlob: "*.pdf",
      debounceMs: 1200,
      stabilityMs: 2000,
    });

    expect(invoke).toHaveBeenCalledWith("create_watch", {
      workflowId: "workflow-1",
      watchPath: "/tmp/inbox",
      recursive: true,
      fileGlob: "*.pdf",
      debounceMs: 1200,
      stabilityMs: 2000,
    });
  });

  it("maps updateWatch payload to camelCase tauri args", async () => {
    await updateWatch({
      id: "watch-1",
      watchPath: "/tmp/next",
      fileGlob: "*.txt",
      debounceMs: 1500,
      stabilityMs: 2500,
    });

    expect(invoke).toHaveBeenCalledWith("update_watch", {
      id: "watch-1",
      watchPath: "/tmp/next",
      recursive: undefined,
      fileGlob: "*.txt",
      debounceMs: 1500,
      stabilityMs: 2500,
    });
  });

  it("maps listAutomationRuns filters to camelCase tauri args", async () => {
    await listAutomationRuns({
      watchId: "watch-1",
      workflowId: "workflow-1",
      limit: 25,
      cursor: 3,
    });

    expect(invoke).toHaveBeenCalledWith("list_automation_runs", {
      watchId: "watch-1",
      workflowId: "workflow-1",
      limit: 25,
      cursor: 3,
    });
  });

  it("maps createSchedule payload to camelCase tauri args", async () => {
    await createSchedule({
      workflowId: "workflow-1",
      cadence: "weekly",
      hourlyInterval: 6,
      weeklyDays: ["mon", "fri"],
      hour: 9,
      minute: 15,
    });

    expect(invoke).toHaveBeenCalledWith("create_schedule", {
      workflowId: "workflow-1",
      cadence: "weekly",
      hourlyInterval: 6,
      weeklyDays: ["mon", "fri"],
      hour: 9,
      minute: 15,
    });
  });

  it("maps listScheduleRuns filters to camelCase tauri args", async () => {
    await listScheduleRuns({
      scheduleId: "schedule-1",
      workflowId: "workflow-1",
      limit: 10,
      cursor: 5,
    });

    expect(invoke).toHaveBeenCalledWith("list_schedule_runs", {
      scheduleId: "schedule-1",
      workflowId: "workflow-1",
      limit: 10,
      cursor: 5,
    });
  });

  it("maps previewFileSortRule payload to snake-free tauri args", async () => {
    await previewFileSortRule({
      samplePath: "/tmp/inbox/report.pdf",
      watchPath: "/tmp/inbox",
      destinationPath: "/tmp/sorted",
      fileGlob: "*.pdf",
      conflictPolicy: "keep_both",
    });

    expect(invoke).toHaveBeenCalledWith("preview_file_sort_rule", {
      samplePath: "/tmp/inbox/report.pdf",
      watchPath: "/tmp/inbox",
      destinationPath: "/tmp/sorted",
      fileGlob: "*.pdf",
      conflictPolicy: "keep_both",
    });
  });
});
