import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { CheckCircle2, FolderOpen, Loader2, PlayCircle } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useAutomationStore } from "@/stores/automationStore";
import { useSetupFlowStore, canContinueStep1, canContinueStep2 } from "@/stores/setupFlowStore";
import { useFlowStore } from "@/stores/flowStore";
import { createGptOssStarterWorkflow } from "@/lib/starterWorkflow";
import { buildFileSortWorkflowName, createFileSortWorkflow } from "@/lib/fileSortWorkflow";
import { toReactFlowGraph } from "@/lib/reactFlowWorkflow";
import { formatRelativeTime } from "@/lib/time";
import { trackEvent } from "@/lib/analytics";
import {
  buildExistingWorkflowPreview,
  buildStarterAutomationPreview,
  summarizeWorkflowForPreview,
} from "@/lib/automationPreview";
import { getStarterRecipeById, STARTER_RECIPES } from "@/lib/setupRecipes";
import { getSetupTrackById, SETUP_TRACKS } from "@/lib/setupTracks";
import type { AutomationRun } from "@/types/automation";
import type { Workflow } from "@/types/workflow";
import type { SetupTrack } from "@/types/setup";
import * as api from "@/lib/tauri";

interface SetupWorkspaceProps {
  onOpenAdvanced: () => void;
}

function StepPill({ currentStep, step, label }: { currentStep: number; step: number; label: string }) {
  const active = currentStep === step;
  const complete = currentStep > step;
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : complete
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
            : "border-border bg-background text-muted-foreground"
      }`}
    >
      {complete ? <CheckCircle2 size={12} /> : <span className="font-semibold">{step}</span>}
      <span>{label}</span>
    </div>
  );
}

function SummaryChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warn" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
        : "border-border bg-background text-foreground";

  return <span className={`rounded-full border px-2 py-1 text-[11px] ${toneClass}`}>{label}</span>;
}

function PreviewSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TrackCard({
  track,
  selected,
  onSelect,
}: {
  track: ReturnType<typeof getSetupTrackById>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-xl border px-4 py-4 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/10 shadow-sm"
          : "border-border bg-background hover:bg-accent/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{track.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{track.subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SummaryChip
            label={track.label}
            tone={track.availability === "available" ? "success" : "warn"}
          />
          {selected ? <CheckCircle2 size={16} className="text-primary" /> : null}
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {track.examples.map((example) => (
          <p key={example}>{example}</p>
        ))}
      </div>
    </button>
  );
}

export function SetupWorkspace({ onOpenAdvanced }: SetupWorkspaceProps) {
  const { workflows, fetchWorkflows, openWorkflow } = useWorkflowStore();
  const { setNodes, setEdges } = useFlowStore();
  const { getRecentRuns, fetchAll, setRunnerEnabled } = useAutomationStore();
  const {
    step,
    setupTrack,
    watchPath,
    recursive,
    fileGlob,
    destinationPath,
    sampleFilePath,
    previewResult,
    previewStatus,
    workflowChoice,
    workflowId,
    starterWorkflowId,
    starterPresetId,
    customPrompt,
    loadedWorkflowPreview,
    createdWatchId,
    status,
    errorMessage,
    errorStage,
    lastRun,
    startedAtMs,
    setWatchPath,
    setRecursive,
    setFileGlob,
    setSetupTrack,
    setDestinationPath,
    setSampleFilePath,
    setPreviewResult,
    setPreviewStatus,
    setWorkflowChoice,
    setWorkflowId,
    setStarterWorkflowId,
    setStarterPresetId,
    setCustomPrompt,
    setLoadedWorkflowPreview,
    setCreatedWatchId,
    setErrorStage,
    goNext,
    goBack,
    setStep,
    startCreate,
    finishCreate,
    failCreate,
    restart,
  } = useSetupFlowStore();

  const [creatingStarter, setCreatingStarter] = useState(false);
  const [creatingAutomation, setCreatingAutomation] = useState(false);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const previewTrackedRef = useRef<string | null>(null);
  const recentRuns = getRecentRuns(3);
  const selectedRecipe = useMemo(() => getStarterRecipeById(starterPresetId), [starterPresetId]);
  const effectivePrompt = customPrompt.trim() || selectedRecipe.prompt;
  const selectedTrack = useMemo(() => getSetupTrackById(setupTrack), [setupTrack]);
  const organizeWorkflowName = useMemo(
    () => buildFileSortWorkflowName(destinationPath.trim() || "Sorted"),
    [destinationPath]
  );

  useEffect(() => {
    void fetchWorkflows();
    void fetchAll();
  }, [fetchAll, fetchWorkflows]);

  useEffect(() => {
    void trackEvent("setup_step_viewed", { step });
  }, [step]);

  useEffect(() => {
    if (workflows.length === 0 && workflowChoice !== "starter") {
      setWorkflowChoice("starter");
      setWorkflowId(starterWorkflowId);
      return;
    }

    if (workflows.length > 0 && workflowChoice === "existing" && !workflowId) {
      setWorkflowId(workflows[0].id);
    }
  }, [setWorkflowChoice, setWorkflowId, starterWorkflowId, workflowChoice, workflowId, workflows]);

  useEffect(() => {
    if (setupTrack !== "understand_contents" || workflowChoice !== "existing" || !workflowId) {
      setLoadedWorkflowPreview(null);
      setPreviewLoadError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoadError(null);

    const loadPreview = async () => {
      try {
        const workflow = await api.loadWorkflow(workflowId);
        if (!cancelled) {
          setLoadedWorkflowPreview(workflow);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadedWorkflowPreview(null);
          setPreviewLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [setLoadedWorkflowPreview, setupTrack, workflowChoice, workflowId]);

  const baseSetupState = {
    step,
    setupTrack,
    watchPath,
    recursive,
    fileGlob,
    destinationPath,
    sampleFilePath,
    previewResult,
    previewStatus,
    workflowChoice,
    workflowId,
    starterWorkflowId,
    starterPresetId,
    customPrompt,
    selectedWorkflowSource: workflowChoice,
    loadedWorkflowPreview,
    createdWatchId: null,
    lastRun,
    status,
    errorMessage,
    errorStage,
    startedAtMs,
  };

  const canGoStep1 = canContinueStep1(baseSetupState);
  const canGoStep2 = canContinueStep2(baseSetupState);
  const canCreateOrganizeAutomation =
    setupTrack === "organize_files" &&
    previewStatus === "success" &&
    Boolean(previewResult?.matches);

  const selectedWorkflowName = useMemo(() => {
    if (setupTrack === "organize_files") {
      return organizeWorkflowName;
    }

    if (workflowChoice === "starter") {
      if (starterWorkflowId) {
        return workflows.find((workflow) => workflow.id === starterWorkflowId)?.name ?? selectedRecipe.workflowName;
      }
      return selectedRecipe.workflowName;
    }

    if (!workflowId) {
      return null;
    }

    return (
      loadedWorkflowPreview?.name ??
      workflows.find((workflow) => workflow.id === workflowId)?.name ??
      workflowId
    );
  }, [loadedWorkflowPreview?.name, organizeWorkflowName, selectedRecipe.workflowName, setupTrack, starterWorkflowId, workflowChoice, workflowId, workflows]);

  const existingWorkflowSummary = useMemo(
    () => (loadedWorkflowPreview ? summarizeWorkflowForPreview(loadedWorkflowPreview) : null),
    [loadedWorkflowPreview]
  );

  const automationPreview = useMemo(() => {
    if (setupTrack === "organize_files") {
      return {
        trigger: [
          `Watch files in ${watchPath || "-"}`,
          recursive ? "Includes subfolders" : "Current folder only",
          `Matches ${fileGlob || "*.*"}`,
        ],
        workflowName: organizeWorkflowName,
        summary: destinationPath.trim()
          ? `Moves each matching file into ${destinationPath.trim()}.`
          : "Moves each matching file into your selected destination folder.",
        instruction: null,
        originalFile: "Original file is moved into the destination folder.",
        outputs: [
          {
            label: "Moved files",
            path: destinationPath.trim() || "Destination folder",
          },
          {
            label: "Run History",
            path: "Recent Automations",
          },
        ],
        gptOssCount: 0,
        nonGptOssCount: 0,
        warning:
          previewStatus === "error"
            ? previewErrorMessage ?? previewResult?.reason ?? "Preview this rule before creating the automation."
            : null,
      };
    }

    if (workflowChoice === "starter") {
      return buildStarterAutomationPreview({
        watchPath,
        recursive,
        fileGlob,
        workflowName: selectedWorkflowName ?? selectedRecipe.workflowName,
        instruction: effectivePrompt,
        recipeSummary: selectedRecipe.previewSummary,
      });
    }

    if (loadedWorkflowPreview) {
      return buildExistingWorkflowPreview({
        workflow: loadedWorkflowPreview,
        watchPath,
        recursive,
        fileGlob,
      });
    }

    return {
      trigger: [
        `Watch files in ${watchPath || "-"}`,
        recursive ? "Includes subfolders" : "Current folder only",
        `Matches ${fileGlob || "*.*"}`,
      ],
      workflowName: selectedWorkflowName ?? "Selected workflow",
      summary: "Runs your saved workflow when a matching file appears.",
      instruction: null,
      originalFile: "This workflow may not move or organize original files.",
      outputs: [{ label: "Run History", path: "Recent Automations" }],
      gptOssCount: 0,
      nonGptOssCount: 0,
      warning: previewLoadError
        ? "Could not load workflow details. Check Advanced Builder for exact behavior."
        : null,
    };
  }, [destinationPath, effectivePrompt, fileGlob, loadedWorkflowPreview, organizeWorkflowName, previewErrorMessage, previewLoadError, previewResult?.reason, previewStatus, recursive, selectedRecipe.previewSummary, selectedRecipe.workflowName, selectedWorkflowName, setupTrack, watchPath, workflowChoice]);

  useEffect(() => {
    if (step !== 3) {
      return;
    }

    const signature = JSON.stringify({
      source: setupTrack === "organize_files" ? "organize" : workflowChoice,
      summary: automationPreview.summary,
      outputs: automationPreview.outputs.map((output) => output.path),
      gptOssCount: automationPreview.gptOssCount,
      nonGptOssCount: automationPreview.nonGptOssCount,
    });

    if (previewTrackedRef.current === signature) {
      return;
    }

    previewTrackedRef.current = signature;
    void trackEvent("setup_preview_viewed", {
      source: setupTrack === "organize_files" ? "organize" : workflowChoice,
      uses_doc_pipeline: automationPreview.outputs.some((output) => output.path.includes("_processed")),
      gpt_oss_count: automationPreview.gptOssCount,
      non_gpt_oss_count: automationPreview.nonGptOssCount,
    });
  }, [automationPreview, setupTrack, step, workflowChoice]);

  const handleBrowseFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setWatchPath(selected);
    }
  };

  const handleBrowseDestination = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setDestinationPath(selected);
    }
  };

  const handleBrowseSampleFile = async () => {
    const selected = await open({ directory: false, multiple: false, defaultPath: watchPath || undefined });
    if (typeof selected === "string") {
      setSampleFilePath(selected);
    }
  };

  const handleTrackChange = (track: SetupTrack) => {
    setSetupTrack(track);
    setPreviewErrorMessage(null);
    void trackEvent("setup_track_selected", { track });
    if (track === "organize_files") {
      void trackEvent("setup_available_path_chosen", { track });
    } else {
      void trackEvent("setup_available_path_chosen", { track });
    }
  };

  const handleStep1Continue = () => {
    if (!canGoStep1) {
      return;
    }
    void trackEvent("setup_step_completed", { step: 1 });
    goNext();
  };

  const handleCreateStarter = async () => {
    if (creatingStarter) {
      return;
    }

    setCreatingStarter(true);
    setErrorStage(null);

    try {
      const existingStarter = starterWorkflowId
        ? workflows.find((workflow) => workflow.id === starterWorkflowId)
        : null;
      const nextWorkflow = createGptOssStarterWorkflow({
        name: selectedRecipe.workflowName,
        prompt: effectivePrompt,
      });
      const workflow: Workflow = existingStarter
        ? {
            ...nextWorkflow,
            id: existingStarter.id,
            created_at: existingStarter.created_at,
          }
        : nextWorkflow;

      await api.saveWorkflow(workflow);
      await fetchWorkflows();
      setWorkflowChoice("starter");
      setStarterWorkflowId(workflow.id);
      setWorkflowId(workflow.id);
      setLoadedWorkflowPreview(workflow);
      void trackEvent("setup_step_completed", { step: 2, action: "starter_created" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorStage("starter_workflow");
      failCreate(message);
    } finally {
      setCreatingStarter(false);
    }
  };

  const handleStep2Continue = () => {
    if (!canGoStep2) {
      return;
    }
    void trackEvent("setup_step_completed", { step: 2 });
    goNext();
  };

  const handlePreviewFileSort = async () => {
    if (
      previewStatus === "loading" ||
      !watchPath.trim() ||
      !destinationPath.trim() ||
      !sampleFilePath.trim()
    ) {
      return;
    }

    setPreviewErrorMessage(null);
    setPreviewStatus("loading");
    setPreviewResult(null);
    setErrorStage(null);

    try {
      void trackEvent("file_sort_preview_requested", {
        watch_path: watchPath.trim(),
        destination_path: destinationPath.trim(),
        file_glob: fileGlob.trim() || "*.*",
      });

      const preview = await api.previewFileSortRule({
        samplePath: sampleFilePath.trim(),
        watchPath: watchPath.trim(),
        destinationPath: destinationPath.trim(),
        fileGlob: fileGlob.trim() || "*.*",
        conflictPolicy: "keep_both",
      });

      setPreviewResult(preview);
      setPreviewStatus(preview.matches ? "success" : "error");
      setPreviewErrorMessage(preview.matches ? null : preview.reason ?? "File does not match this rule.");

      void trackEvent("file_sort_preview_completed", {
        matches: preview.matches,
        conflict_resolution: preview.conflict_resolution,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewStatus("error");
      setPreviewErrorMessage(message);
      setErrorStage("preview_file_sort");
    }
  };

  const handleCreateAutomation = async () => {
    if (creatingAutomation || !watchPath.trim()) {
      return;
    }

    setCreatingAutomation(true);
    startCreate();

    let currentStage: "create_watch" | "run_watch_now" = "create_watch";

    try {
      await setRunnerEnabled(true);

      if (setupTrack === "organize_files") {
        if (!destinationPath.trim() || !previewResult?.matches) {
          return;
        }

        const workflow = createFileSortWorkflow({
          name: organizeWorkflowName,
          destinationPath: destinationPath.trim(),
        });
        await api.saveWorkflow(workflow);
        await fetchWorkflows();
        setWorkflowId(workflow.id);
        setLoadedWorkflowPreview(workflow);

        setErrorStage("create_watch");
        const watch = await api.createWatch({
          workflowId: workflow.id,
          watchPath: watchPath.trim(),
          recursive,
          fileGlob: fileGlob.trim() || "*.*",
        });
        setCreatedWatchId(watch.id);
        await fetchAll();

        const now = new Date().toISOString();
        const syntheticRun: AutomationRun = {
          id: `preview-${watch.id}`,
          watch_id: watch.id,
          workflow_id: workflow.id,
          trigger_file_path: sampleFilePath.trim() || previewResult.source_path,
          trigger_event_id: "preview:file_sort",
          status: "success",
          started_at: now,
          ended_at: now,
          duration_ms: 0,
          result_summary: `Preview passed: matching files will move to ${previewResult.final_path}`,
        };

        finishCreate(syntheticRun, watch.id);
        void trackEvent("file_sort_automation_created", {
          workflow_id: workflow.id,
          watch_id: watch.id,
          destination_path: destinationPath.trim(),
        });
        void trackEvent("setup_step_completed", { step: 3 });
        void trackEvent("setup_flow_completed", {
          workflow_id: workflow.id,
          watch_id: watch.id,
          test_run_status: "preview_success",
          flow_elapsed_ms: Date.now() - startedAtMs,
        });
        return;
      }

      if (!workflowId) {
        return;
      }

      let watchId = createdWatchId;

      if (!watchId) {
        setErrorStage("create_watch");
        const watch = await api.createWatch({
          workflowId,
          watchPath: watchPath.trim(),
          recursive,
          fileGlob: fileGlob.trim() || "*.*",
        });
        watchId = watch.id;
        setCreatedWatchId(watchId);
      }

      currentStage = "run_watch_now";
      setErrorStage("run_watch_now");
      const run = await api.runWatchNow(watchId);
      finishCreate(run, watchId);
      await fetchAll();
      void trackEvent("setup_step_completed", { step: 3 });
      void trackEvent("setup_flow_completed", {
        workflow_id: workflowId,
        watch_id: watchId,
        test_run_status: run.status,
        flow_elapsed_ms: Date.now() - startedAtMs,
      });

      if (run.status === "error") {
        void trackEvent("setup_create_failed", {
          stage: "run_watch_now",
          message: run.error_message ?? "Run failed",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorStage(currentStage);
      failCreate(message);
      void trackEvent("setup_create_failed", {
        stage: currentStage,
        message,
      });
    } finally {
      setCreatingAutomation(false);
    }
  };

  const handleOpenAdvanced = async () => {
    if (workflowId) {
      try {
        const workflow = await openWorkflow(workflowId);
        const graph = toReactFlowGraph(workflow);
        setNodes(graph.nodes);
        setEdges(graph.edges);
      } catch {}
    }
    onOpenAdvanced();
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Set Up File Automation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Synapse watches a folder and reacts when matching files appear.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StepPill currentStep={step} step={1} label="Choose Folder" />
          <StepPill currentStep={step} step={2} label="Choose What Happens" />
          <StepPill currentStep={step} step={3} label="Review" />
        </div>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground">Choose where new files will appear</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Synapse watches this folder and reacts when matching files are added.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  value={watchPath}
                  onChange={(event) => setWatchPath(event.target.value)}
                  placeholder="Choose a folder to watch..."
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleBrowseFolder}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/30"
                >
                  <FolderOpen size={14} />
                  Pick Folder
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(event) => setRecursive(event.target.checked)}
                  />
                  Watch subfolders
                </label>
                <input
                  value={fileGlob}
                  onChange={(event) => setFileGlob(event.target.value)}
                  className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="*.*"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleStep1Continue}
                  disabled={!canGoStep1}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-medium text-foreground">What should happen when a new file appears?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the kind of file automation you want Synapse to handle.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {SETUP_TRACKS.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    selected={setupTrack === track.id}
                    onSelect={() => handleTrackChange(track.id)}
                  />
                ))}
              </div>

              {setupTrack === "organize_files" && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">Organize matching files</p>
                      <SummaryChip label={selectedTrack.label} tone="success" />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Synapse moves matching files to one destination folder. Original files are moved in live mode.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={destinationPath}
                      onChange={(event) => setDestinationPath(event.target.value)}
                      placeholder="Choose a destination folder..."
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => void handleBrowseDestination()}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/30"
                    >
                      <FolderOpen size={14} />
                      Pick Folder
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</p>
                      <p className="mt-2 text-sm text-foreground">Move matching files to this folder</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conflict handling</p>
                      <p className="mt-2 text-sm text-foreground">Keep both files</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Safety</p>
                      <p className="mt-2 text-sm text-foreground">Test with a sample file before activation</p>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={goBack}
                      className="rounded-md border border-input bg-background px-4 py-2 text-sm transition-colors hover:bg-accent/20"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleStep2Continue}
                      disabled={!canGoStep2}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {setupTrack === "understand_contents" && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Choose how Synapse should process each file</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      These options do not move the original file. They read it and create new result files.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      onClick={() => setWorkflowChoice("existing")}
                      disabled={workflows.length === 0}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                        workflowChoice === "existing"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-accent/20"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <p className="text-sm font-semibold text-foreground">Use an existing workflow you already built</p>
                      <p className="mt-1 text-xs text-muted-foreground">Run your saved workflow when a matching file appears.</p>
                    </button>

                    <button
                      onClick={() => setWorkflowChoice("starter")}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                        workflowChoice === "starter"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-accent/20"
                      }`}
                    >
                      <p className="text-sm font-semibold text-foreground">Create GPT-OSS starter</p>
                      <p className="mt-1 text-xs text-muted-foreground">Use GPT-OSS to read each file and create helpful result files automatically.</p>
                    </button>
                  </div>

                  {workflowChoice === "existing" && (
                    <div className="space-y-3">
                      <select
                        value={workflowId ?? ""}
                        onChange={(event) => setWorkflowId(event.target.value || null)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Select workflow</option>
                        {workflows.map((workflow) => (
                          <option key={workflow.id} value={workflow.id}>
                            {workflow.name}
                          </option>
                        ))}
                      </select>

                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {selectedWorkflowName ?? "Select a workflow to preview it"}
                          </p>
                          {existingWorkflowSummary?.gptOssModelsCount ? (
                            <SummaryChip label={`GPT-OSS ${existingWorkflowSummary.gptOssModelsCount}`} tone="success" />
                          ) : null}
                          {existingWorkflowSummary?.nonGptOssModelsCount ? (
                            <SummaryChip label={`Other Models ${existingWorkflowSummary.nonGptOssModelsCount}`} tone="warn" />
                          ) : null}
                          {existingWorkflowSummary?.usesDocPipeline ? (
                            <SummaryChip label="Content processing" tone="success" />
                          ) : null}
                        </div>

                        {loadedWorkflowPreview ? (
                          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <p>{automationPreview.summary}</p>
                            <p>{automationPreview.originalFile}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">
                            {previewLoadError ?? "Select a workflow to preview its behavior."}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {workflowChoice === "starter" && (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        {STARTER_RECIPES.map((recipe) => {
                          const active = recipe.id === starterPresetId;
                          return (
                            <button
                              key={recipe.id}
                              onClick={() => {
                                setStarterPresetId(recipe.id);
                              }}
                              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                                active
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background hover:bg-accent/20"
                              }`}
                            >
                              <p className="text-sm font-semibold text-foreground">{recipe.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{recipe.description}</p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">Fine-tune what Synapse writes after reading each file</p>
                          {effectivePrompt !== selectedRecipe.prompt ? (
                            <SummaryChip label="Customized" tone="warn" />
                          ) : (
                            <SummaryChip label="Using recipe" tone="success" />
                          )}
                        </div>
                        <textarea
                          value={customPrompt}
                          onChange={(event) => setCustomPrompt(event.target.value)}
                          className="mt-3 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <p className="mt-3 text-xs text-muted-foreground">{selectedRecipe.previewSummary}</p>
                        <button
                          onClick={() => void handleCreateStarter()}
                          disabled={creatingStarter}
                          className="mt-4 inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {creatingStarter ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                          {starterWorkflowId ? "Save starter workflow" : "Create starter workflow"}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedWorkflowName && (
                    <p className="text-sm text-muted-foreground">
                      Selected: <span className="font-medium text-foreground">{selectedWorkflowName}</span>
                    </p>
                  )}

                  {status === "error" && errorStage === "starter_workflow" && errorMessage && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                      Could not save starter workflow. {errorMessage}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button
                      onClick={goBack}
                      className="rounded-md border border-input bg-background px-4 py-2 text-sm transition-colors hover:bg-accent/20"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleStep2Continue}
                      disabled={!canGoStep2}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground">Review this file automation</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confirm what will happen when a matching file appears.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{automationPreview.workflowName}</p>
                  {automationPreview.gptOssCount > 0 ? (
                    <SummaryChip label={`GPT-OSS ${automationPreview.gptOssCount}`} tone="success" />
                  ) : null}
                  {automationPreview.nonGptOssCount > 0 ? (
                    <SummaryChip label={`Other Models ${automationPreview.nonGptOssCount}`} tone="warn" />
                  ) : null}
                </div>

                {automationPreview.warning ? (
                  <p className="mt-2 text-sm text-amber-700">{automationPreview.warning}</p>
                ) : null}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <PreviewSection title="When a file appears" items={automationPreview.trigger} />
                  <PreviewSection title="Synapse will" items={[automationPreview.summary]} />
                  <PreviewSection title="Original file" items={[automationPreview.originalFile]} />
                  <PreviewSection
                    title="New files created"
                    items={automationPreview.outputs.map((output) => `${output.label}: ${output.path}`)}
                  />
                </div>

                {automationPreview.instruction ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instruction</p>
                    <p className="mt-2 text-sm text-foreground">{automationPreview.instruction}</p>
                  </div>
                ) : null}
              </div>

              {setupTrack === "organize_files" && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Rule preview</p>
                    {previewStatus === "success" && previewResult?.matches ? (
                      <SummaryChip label="Ready to activate" tone="success" />
                    ) : null}
                    {previewStatus === "error" ? (
                      <SummaryChip label="Preview required" tone="warn" />
                    ) : null}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={sampleFilePath}
                      onChange={(event) => setSampleFilePath(event.target.value)}
                      placeholder="Choose a sample file to test..."
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => void handleBrowseSampleFile()}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/30"
                    >
                      <FolderOpen size={14} />
                      Pick File
                    </button>
                    <button
                      onClick={() => void handlePreviewFileSort()}
                      disabled={
                        previewStatus === "loading" ||
                        !sampleFilePath.trim() ||
                        !destinationPath.trim()
                      }
                      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {previewStatus === "loading" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <PlayCircle size={14} />
                      )}
                      Preview Rule
                    </button>
                  </div>

                  {previewResult && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Would match this rule?</p>
                        <p className="mt-2 text-sm text-foreground">
                          {previewResult.matches ? "Yes, this file matches the rule." : "No, this file would be skipped."}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conflict handling</p>
                        <p className="mt-2 text-sm text-foreground">Keep both files</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Would move from</p>
                        <p className="mt-2 break-all text-sm text-foreground">{previewResult.source_path}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Would move to</p>
                        <p className="mt-2 break-all text-sm text-foreground">{previewResult.final_path}</p>
                      </div>
                    </div>
                  )}

                  {previewErrorMessage ? (
                    <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
                      {previewErrorMessage}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={goBack}
                  disabled={creatingAutomation}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  onClick={() => void handleCreateAutomation()}
                  disabled={creatingAutomation || (setupTrack === "organize_files" && !canCreateOrganizeAutomation)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {creatingAutomation ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <PlayCircle size={14} />
                  )}
                  Create Automation
                </button>
              </div>

              {status === "success" && lastRun && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                  <p className="font-semibold">
                    {setupTrack === "organize_files"
                      ? "Automation created. Preview confirms this rule is ready to run live."
                      : "Automation created and test run succeeded."}
                  </p>
                  <p className="mt-1">
                    {setupTrack === "organize_files"
                      ? lastRun.result_summary ?? `Matching files will move to ${destinationPath}.`
                      : `Duration: ${lastRun.duration_ms}ms`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleOpenAdvanced()}
                      className="rounded-md border border-emerald-700/30 bg-background px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10"
                    >
                      Open Advanced Builder
                    </button>
                    <button
                      onClick={() => {
                        restart();
                        setStep(1);
                      }}
                      className="rounded-md border border-emerald-700/30 bg-background px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10"
                    >
                      Create Another Automation
                    </button>
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-semibold">
                    {errorStage === "run_watch_now"
                      ? "Automation created, but test run failed."
                      : errorStage === "preview_file_sort"
                        ? "Preview failed."
                      : "Could not create automation."}
                  </p>
                  <p className="mt-1">{errorMessage ?? "Unknown error"}</p>
                  <p className="mt-2 text-xs">
                    {errorStage === "preview_file_sort"
                      ? "Choose a sample file that matches your rule and try the preview again."
                      : errorStage === "run_watch_now"
                      ? "The watch already exists. Retry the confirmation run or open the advanced builder to inspect the workflow."
                      : "Check the selected folder and workflow, then try creating the automation again."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleCreateAutomation()}
                      className="rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      {errorStage === "run_watch_now"
                        ? "Retry Test Run"
                        : errorStage === "preview_file_sort"
                          ? "Retry Preview"
                          : "Retry Create Automation"}
                    </button>
                    <button
                      onClick={() => void handleOpenAdvanced()}
                      className="rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      Open Advanced Builder
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Automations
          </p>
          <div className="mt-2 space-y-1.5">
            {recentRuns.length === 0 && (
              <p className="text-sm text-muted-foreground">No automation runs yet.</p>
            )}
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-foreground">{run.trigger_file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.status} · {run.duration_ms}ms · {formatRelativeTime(run.ended_at)}
                  </p>
                </div>
                {run.result_summary ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{run.result_summary}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
