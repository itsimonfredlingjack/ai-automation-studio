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
    expect(initial.setupTrack).toBe("organize_files");
    expect(initial.starterPresetId).toBe("summary");
    expect(initial.customPrompt).toContain("Summarize");
    expect(initial.errorStage).toBeNull();

    expect(
      canContinueStep1({
        ...initial,
        watchPath: "/Users/simon/Documents/inbox",
      })
    ).toBe(true);

    expect(
      canContinueStep2({
        ...initial,
        destinationPath: "/Users/simon/Documents/Sorted",
      })
    ).toBe(true);

    expect(
      canContinueStep2({
        ...initial,
        setupTrack: "understand_contents",
        workflowId: "workflow-123",
      })
    ).toBe(true);
  });
});

describe("setupFlowStore transitions", () => {
  it("moves between steps, tracks prompt customization, switches setup tracks, and preserves retry state", () => {
    useSetupFlowStore.getState().restart();
    useSetupFlowStore.getState().setWatchPath("/tmp/inbox");
    useSetupFlowStore.getState().goNext();
    expect(useSetupFlowStore.getState().step).toBe(2);
    expect(useSetupFlowStore.getState().destinationPath).toBe("");
    expect(useSetupFlowStore.getState().previewStatus).toBe("idle");

    useSetupFlowStore.getState().setSetupTrack("organize_files");
    expect(useSetupFlowStore.getState().setupTrack).toBe("organize_files");

    useSetupFlowStore
      .getState()
      .setDestinationPath("/Users/coffeedev/Documents/Sorted");
    useSetupFlowStore
      .getState()
      .setSampleFilePath("/Users/coffeedev/Documents/inbox/report.pdf");
    useSetupFlowStore.getState().setPreviewStatus("success");
    useSetupFlowStore.getState().setPreviewResult({
      matches: true,
      source_path: "/Users/coffeedev/Documents/inbox/report.pdf",
      destination_dir: "/Users/coffeedev/Documents/Sorted",
      proposed_path: "/Users/coffeedev/Documents/Sorted/report.pdf",
      final_path: "/Users/coffeedev/Documents/Sorted/report.pdf",
      action: "move",
      conflict_resolution: "none",
    });
    expect(useSetupFlowStore.getState().previewStatus).toBe("success");
    expect(useSetupFlowStore.getState().previewResult?.matches).toBe(true);

    useSetupFlowStore.getState().setSetupTrack("understand_contents");
    expect(useSetupFlowStore.getState().setupTrack).toBe("understand_contents");

    useSetupFlowStore.getState().setStarterPresetId("action_items");
    expect(useSetupFlowStore.getState().starterPresetId).toBe("action_items");
    expect(useSetupFlowStore.getState().customPrompt).toContain("action items");

    useSetupFlowStore
      .getState()
      .setCustomPrompt("Extract tasks, owners, and deadlines from the file.");
    expect(useSetupFlowStore.getState().customPrompt).toBe(
      "Extract tasks, owners, and deadlines from the file."
    );

    useSetupFlowStore.getState().setWorkflowId("workflow-1");
    useSetupFlowStore.getState().goNext();
    expect(useSetupFlowStore.getState().step).toBe(3);

    useSetupFlowStore.getState().startCreate();
    useSetupFlowStore.getState().setCreatedWatchId("watch-1");
    useSetupFlowStore.getState().setErrorStage("run_watch_now");
    useSetupFlowStore.getState().failCreate("Tool run failed");

    const failed = useSetupFlowStore.getState();
    expect(failed.errorStage).toBe("run_watch_now");
    expect(failed.createdWatchId).toBe("watch-1");
    expect(failed.status).toBe("error");

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
    expect(current.errorStage).toBeNull();
  });
});
