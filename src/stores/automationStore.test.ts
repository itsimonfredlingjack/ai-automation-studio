import { describe, expect, it } from "vitest";
import {
  buildAutomationHealthSnapshot,
  getRunsInLast24Hours,
  sortWatchesForDisplay,
  toRecentRunItems,
} from "@/stores/automationStore";
import type { AutomationRun, AutomationWatch } from "@/types/automation";

const NOW = new Date("2026-02-27T12:00:00.000Z").getTime();

function makeWatch(values: Partial<AutomationWatch>): AutomationWatch {
  return {
    id: values.id ?? "watch-1",
    workflow_id: values.workflow_id ?? "workflow-1",
    watch_path: values.watch_path ?? "/tmp/inbox",
    recursive: values.recursive ?? true,
    file_glob: values.file_glob ?? "*.*",
    status: values.status ?? "active",
    debounce_ms: values.debounce_ms ?? 1200,
    stability_ms: values.stability_ms ?? 2000,
    created_at: values.created_at ?? "2026-02-27T10:00:00.000Z",
    updated_at: values.updated_at ?? "2026-02-27T11:00:00.000Z",
  };
}

function makeRun(values: Partial<AutomationRun>): AutomationRun {
  return {
    id: values.id ?? "run-1",
    watch_id: values.watch_id ?? "watch-1",
    workflow_id: values.workflow_id ?? "workflow-1",
    trigger_file_path: values.trigger_file_path ?? "/tmp/inbox/file.pdf",
    trigger_event_id: values.trigger_event_id ?? "event-1",
    status: values.status ?? "success",
    started_at: values.started_at ?? "2026-02-27T11:00:00.000Z",
    ended_at: values.ended_at ?? "2026-02-27T11:01:00.000Z",
    duration_ms: values.duration_ms ?? 60_000,
    result_summary: values.result_summary,
    error_message: values.error_message,
  };
}

describe("automationStore selectors", () => {
  it("sorts watches by status priority and updated_at desc", () => {
    const watches: AutomationWatch[] = [
      makeWatch({
        id: "disabled",
        status: "disabled",
        updated_at: "2026-02-27T11:30:00.000Z",
      }),
      makeWatch({
        id: "paused",
        status: "paused",
        updated_at: "2026-02-27T11:40:00.000Z",
      }),
      makeWatch({
        id: "active-older",
        status: "active",
        updated_at: "2026-02-27T11:20:00.000Z",
      }),
      makeWatch({
        id: "active-newer",
        status: "active",
        updated_at: "2026-02-27T11:50:00.000Z",
      }),
    ];

    const sorted = sortWatchesForDisplay(watches);
    expect(sorted.map((watch) => watch.id)).toEqual([
      "active-newer",
      "active-older",
      "paused",
      "disabled",
    ]);
  });

  it("returns only runs completed in the last 24 hours", () => {
    const runs: AutomationRun[] = [
      makeRun({ id: "fresh", ended_at: "2026-02-27T11:00:00.000Z" }),
      makeRun({ id: "still-valid", ended_at: "2026-02-26T12:30:00.000Z" }),
      makeRun({ id: "old", ended_at: "2026-02-26T10:00:00.000Z" }),
    ];

    const recent = getRunsInLast24Hours(runs, NOW);
    expect(recent.map((run) => run.id)).toEqual(["fresh", "still-valid"]);
  });

  it("builds health snapshot counts from watches and runs", () => {
    const watches: AutomationWatch[] = [
      makeWatch({ id: "a1", status: "active" }),
      makeWatch({ id: "a2", status: "active" }),
      makeWatch({ id: "p1", status: "paused" }),
      makeWatch({ id: "d1", status: "disabled" }),
    ];
    const runs: AutomationRun[] = [
      makeRun({ id: "s1", status: "success", ended_at: "2026-02-27T11:00:00.000Z" }),
      makeRun({ id: "s2", status: "success", ended_at: "2026-02-27T10:00:00.000Z" }),
      makeRun({ id: "e1", status: "error", ended_at: "2026-02-27T09:00:00.000Z" }),
      makeRun({ id: "old", status: "error", ended_at: "2026-02-25T09:00:00.000Z" }),
    ];

    expect(buildAutomationHealthSnapshot(watches, runs, NOW)).toEqual({
      active_watches: 2,
      paused_watches: 1,
      disabled_watches: 1,
      successful_runs_24h: 2,
      failed_runs_24h: 1,
    });
  });

  it("maps recent runs with extracted file names", () => {
    const runs: AutomationRun[] = [
      makeRun({
        id: "latest",
        ended_at: "2026-02-27T11:55:00.000Z",
        trigger_file_path: "/tmp/inbox/new.pdf",
      }),
      makeRun({
        id: "windows-path",
        ended_at: "2026-02-27T11:30:00.000Z",
        trigger_file_path: "C:\\docs\\report.txt",
      }),
    ];

    const items = toRecentRunItems(runs, 2);
    expect(items[0].trigger_file_name).toBe("new.pdf");
    expect(items[1].trigger_file_name).toBe("report.txt");
  });

  it("preserves run summaries for file automation history", () => {
    const runs: AutomationRun[] = [
      makeRun({
        id: "sorted",
        result_summary: "Moved report.pdf to /tmp/sorted/report.pdf",
      }),
    ];

    const items = toRecentRunItems(runs, 1);
    expect(items[0].result_summary).toBe(
      "Moved report.pdf to /tmp/sorted/report.pdf"
    );
  });
});
