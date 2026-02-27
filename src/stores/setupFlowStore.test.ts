import { describe, expect, it } from "vitest";
import {
  canContinueStep1,
  canContinueStep2,
  createInitialSetupFlowState,
  useSetupFlowStore,
} from "@/stores/setupFlowStore";

describe("setupFlowStore helpers", () => {
  it("validates step 1 and step 2 readiness", () => {
    const initial = createInitialSetupFlowState();
    expect(canContinueStep1(initial)).toBe(false);
    expect(canContinueStep2(initial)).toBe(false);

    expect(
      canContinueStep1({
        ...initial,
        watchPath: "/Users/simon/Documents/inbox",
      })
    ).toBe(true);

    expect(
      canContinueStep2({
        ...initial,
        workflowId: "workflow-123",
      })
    ).toBe(true);
  });
});

describe("setupFlowStore transitions", () => {
  it("moves between steps and records creation success", () => {
    useSetupFlowStore.getState().restart();
    useSetupFlowStore.getState().setWatchPath("/tmp/inbox");
    useSetupFlowStore.getState().goNext();
    expect(useSetupFlowStore.getState().step).toBe(2);

    useSetupFlowStore.getState().setWorkflowId("workflow-1");
    useSetupFlowStore.getState().goNext();
    expect(useSetupFlowStore.getState().step).toBe(3);

    useSetupFlowStore.getState().startCreate();
    useSetupFlowStore.getState().finishCreate(
      {
        id: "run-1",
        watch_id: "watch-1",
        workflow_id: "workflow-1",
        trigger_file_path: "[manual-run]",
        trigger_event_id: "event-1",
        status: "success",
        started_at: "2026-02-27T12:00:00.000Z",
        ended_at: "2026-02-27T12:00:01.000Z",
        duration_ms: 1000,
      },
      "watch-1"
    );

    const current = useSetupFlowStore.getState();
    expect(current.status).toBe("success");
    expect(current.createdWatchId).toBe("watch-1");
    expect(current.lastRun?.status).toBe("success");
  });
});
