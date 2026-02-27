import { Play, FlaskConical, Loader2 } from "lucide-react";
import { useExecutionStore } from "@/stores/executionStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useFlowStore } from "@/stores/flowStore";
import { useAiSystemStore } from "@/stores/aiSystemStore";
import * as api from "@/lib/tauri";
import { buildWorkflowPayload } from "@/lib/workflowPayload";

export function Toolbar() {
  const { isRunning, mode, startExecution, setResult, setError } =
    useExecutionStore();
  const { currentWorkflowId, workflows, saveCurrentWorkflow } =
    useWorkflowStore();
  const { nodes, edges } = useFlowStore();
  const { refreshGptOssStatus } = useAiSystemStore();

  const handleRun = async (runMode: "execute" | "test") => {
    if (!currentWorkflowId || isRunning) return;

    const current = workflows.find((w) => w.id === currentWorkflowId);
    if (!current) return;

    startExecution(runMode);

    try {
      await refreshGptOssStatus();

      // Auto-save before executing
      const workflow = buildWorkflowPayload({
        workflowId: currentWorkflowId,
        name: current.name,
        description: current.description,
        createdAt: current.created_at,
        nodes,
        edges,
      });
      await saveCurrentWorkflow(workflow);

      const result = await api.executeWorkflowDebug(currentWorkflowId);
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      await refreshGptOssStatus();
    }
  };

  const disabled = !currentWorkflowId || isRunning || nodes.length === 0;

  return (
    <div className="flex h-11 items-center gap-2 border-b border-border bg-card px-4">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-2">
        Workflow
      </span>

      <button
        onClick={() => handleRun("execute")}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isRunning && mode === "execute" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Play size={14} />
        )}
        Execute
      </button>

      <button
        onClick={() => handleRun("test")}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isRunning && mode === "test" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FlaskConical size={14} />
        )}
        Test
      </button>

      {isRunning && (
        <span className="text-xs text-muted-foreground ml-2">Running...</span>
      )}
    </div>
  );
}
