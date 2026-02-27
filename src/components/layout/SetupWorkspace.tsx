import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { CheckCircle2, FolderOpen, Loader2, PlayCircle } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useAutomationStore } from "@/stores/automationStore";
import { useSetupFlowStore, canContinueStep1, canContinueStep2 } from "@/stores/setupFlowStore";
import { useFlowStore } from "@/stores/flowStore";
import { createGptOssStarterWorkflow } from "@/lib/starterWorkflow";
import { toReactFlowGraph } from "@/lib/reactFlowWorkflow";
import { formatRelativeTime } from "@/lib/time";
import { trackEvent } from "@/lib/analytics";
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

export function SetupWorkspace({ onOpenAdvanced }: SetupWorkspaceProps) {
  const { workflows, fetchWorkflows, openWorkflow } = useWorkflowStore();
  const { setNodes, setEdges } = useFlowStore();
  const {
    getRecentRuns,
    fetchAll,
    setRunnerEnabled,
  } = useAutomationStore();
  const {
    step,
    watchPath,
    recursive,
    fileGlob,
    workflowChoice,
    workflowId,
    starterWorkflowId,
    createdWatchId,
    status,
    errorMessage,
    lastRun,
    startedAtMs,
    setWatchPath,
    setRecursive,
    setFileGlob,
    setWorkflowChoice,
    setWorkflowId,
    setStarterWorkflowId,
    setCreatedWatchId,
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
  const recentRuns = getRecentRuns(3);

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
      setWorkflowId(null);
    }
    if (workflows.length > 0 && workflowChoice === "existing" && !workflowId) {
      setWorkflowId(workflows[0].id);
    }
  }, [setWorkflowChoice, setWorkflowId, workflowChoice, workflowId, workflows]);

  const canGoStep1 = canContinueStep1({
    step,
    watchPath,
    recursive,
    fileGlob,
    workflowChoice,
    workflowId,
    starterWorkflowId,
    createdWatchId: null,
    lastRun,
    status,
    errorMessage,
    startedAtMs,
  });

  const canGoStep2 = canContinueStep2({
    step,
    watchPath,
    recursive,
    fileGlob,
    workflowChoice,
    workflowId,
    starterWorkflowId,
    createdWatchId: null,
    lastRun,
    status,
    errorMessage,
    startedAtMs,
  });

  const selectedWorkflowName = useMemo(() => {
    if (!workflowId) return null;
    return workflows.find((workflow) => workflow.id === workflowId)?.name ?? workflowId;
  }, [workflowId, workflows]);

  const handleBrowseFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setWatchPath(selected);
    }
  };

  const handleStep1Continue = () => {
    if (!canGoStep1) return;
    void trackEvent("setup_step_completed", { step: 1 });
    goNext();
  };

  const handleCreateStarter = async () => {
    if (creatingStarter) return;
    setCreatingStarter(true);
    try {
      const workflow = createGptOssStarterWorkflow(
        `GPT-OSS Starter ${new Date().toLocaleDateString()}`
      );
      await api.saveWorkflow(workflow);
      await fetchWorkflows();
      setWorkflowChoice("starter");
      setStarterWorkflowId(workflow.id);
      setWorkflowId(workflow.id);
      void trackEvent("setup_step_completed", { step: 2, action: "starter_created" });
    } catch (error) {
      void failCreate(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingStarter(false);
    }
  };

  const handleStep2Continue = () => {
    if (!canGoStep2) return;
    void trackEvent("setup_step_completed", { step: 2 });
    goNext();
  };

  const handleCreateAutomation = async () => {
    if (creatingAutomation || !workflowId || !watchPath.trim()) {
      return;
    }

    setCreatingAutomation(true);
    startCreate();
    try {
      await setRunnerEnabled(true);
      let watchId = createdWatchId;
      if (!watchId) {
        const watch = await api.createWatch({
          workflow_id: workflowId,
          watch_path: watchPath.trim(),
          recursive,
          file_glob: fileGlob.trim() || "*.*",
        });
        watchId = watch.id;
        setCreatedWatchId(watchId);
      }

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
    } catch (error) {
      failCreate(error instanceof Error ? error.message : String(error));
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
      <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Set Up File Automation
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Three quick steps. No graph editing required.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StepPill currentStep={step} step={1} label="Choose Folder" />
          <StepPill currentStep={step} step={2} label="Choose Workflow" />
          <StepPill currentStep={step} step={3} label="Test & Enable" />
        </div>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Step 1: Choose source folder</h3>
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
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Step 2: Choose workflow</h3>

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
                  <p className="text-sm font-semibold text-foreground">Use existing workflow</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick one of your saved workflows.
                  </p>
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    Builds Text Input → AI Agent → Text Output.
                  </p>
                </button>
              </div>

              {workflowChoice === "existing" && (
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
              )}

              {workflowChoice === "starter" && (
                <button
                  onClick={() => void handleCreateStarter()}
                  disabled={creatingStarter}
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {creatingStarter ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                  Create starter workflow
                </button>
              )}

              {selectedWorkflowName && (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{selectedWorkflowName}</span>
                </p>
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

          {status === "error" && step !== 3 && errorMessage && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Step 3: Test and enable</h3>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p>
                  Folder: <span className="font-medium">{watchPath || "-"}</span>
                </p>
                <p>
                  Workflow: <span className="font-medium">{selectedWorkflowName || "-"}</span>
                </p>
                <p>
                  Filter: <span className="font-medium">{fileGlob || "*.*"}</span>
                </p>
              </div>

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
                  disabled={creatingAutomation}
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
                  <p className="font-semibold">Automation created and test run succeeded.</p>
                  <p className="mt-1">Duration: {lastRun.duration_ms}ms</p>
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
                    {createdWatchId
                      ? "Automation was created, but test run failed."
                      : "Could not create automation."}
                  </p>
                  <p className="mt-1">{errorMessage ?? "Unknown error"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleCreateAutomation()}
                      className="rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      {createdWatchId ? "Retry Test Run" : "Retry Create Automation"}
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
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <p className="truncate text-foreground">{run.trigger_file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {run.status} · {run.duration_ms}ms · {formatRelativeTime(run.ended_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
