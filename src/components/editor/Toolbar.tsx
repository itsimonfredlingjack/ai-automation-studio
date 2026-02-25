import { Play, FlaskConical, Loader2 } from "lucide-react";
import { useExecutionStore } from "@/stores/executionStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useFlowStore } from "@/stores/flowStore";
import * as api from "@/lib/tauri";
import { buildWorkflowPayload } from "@/lib/workflowPayload";

export function Toolbar() {
  const { isRunning, mode, startExecution, setResult, setError } =
    useExecutionStore();
  const { currentWorkflowId, workflows, saveCurrentWorkflow } =
    useWorkflowStore();
  const { nodes, edges } = useFlowStore();

  const handleRun = async (runMode: "execute" | "test") => {
    if (!currentWorkflowId || isRunning) return;

    const current = workflows.find((w) => w.id === currentWorkflowId);
    if (!current) return;

    startExecution(runMode);

    try {
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

      if (runMode === "test") {
        const result = await api.executeWorkflowDebug(currentWorkflowId);
        setResult(result);
      } else {
        const outputs = await api.executeWorkflow(currentWorkflowId);
        setResult({
          final_outputs: outputs,
          steps: [],
          total_duration_ms: 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
