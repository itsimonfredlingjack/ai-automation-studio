import { Link2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFlowStore } from "@/stores/flowStore";
import {
  type ExecutionResult,
  useExecutionStore,
} from "@/stores/executionStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { buildWorkflowPayload } from "@/lib/workflowPayload";
import { createTemplateLink, createTemplatePayload } from "@/lib/templateShare";
import { trackEvent } from "@/lib/analytics";

interface ShareStatus {
  type: "success" | "error";
  message: string;
}

interface ExecutionSharePromptProps {
  error: string | null;
  mode: "execute" | "test" | null;
  result: ExecutionResult | null;
}

export function ExecutionSharePrompt({
  error,
  mode,
  result,
}: ExecutionSharePromptProps) {
  const { showResults } = useExecutionStore();
  const { nodes, edges } = useFlowStore();
  const { currentWorkflowId, workflows, saveCurrentWorkflow } =
    useWorkflowStore();
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null);
  const trackedPromptRef = useRef<string | null>(null);

  const currentWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === currentWorkflowId) ?? null,
    [workflows, currentWorkflowId]
  );

  const canShare =
    Boolean(showResults) &&
    Boolean(result) &&
    !error &&
    Boolean(currentWorkflowId) &&
    Boolean(currentWorkflow) &&
    nodes.length > 0;

  useEffect(() => {
    if (!result) {
      setShareStatus(null);
      setIsSharing(false);
      return;
    }

    if (!canShare || !currentWorkflowId) {
      return;
    }

    const outputCount = Object.keys(result.final_outputs).length;
    const key = `${currentWorkflowId}:${mode ?? "unknown"}:${result.total_duration_ms}:${result.steps.length}:${outputCount}`;
    if (trackedPromptRef.current === key) {
      return;
    }

    trackedPromptRef.current = key;
    void trackEvent("share_prompt_viewed", {
      workflow_id: currentWorkflowId,
      mode: mode ?? "unknown",
      node_count: nodes.length,
      edge_count: edges.length,
      output_count: outputCount,
      surface: "execution_results",
    });
  }, [canShare, currentWorkflowId, edges.length, mode, nodes.length, result]);

  const handleShare = async () => {
    if (!canShare || !currentWorkflow || !currentWorkflowId || isSharing) {
      return;
    }

    setShareStatus(null);
    setIsSharing(true);

    try {
      const workflow = buildWorkflowPayload({
        workflowId: currentWorkflowId,
        name: currentWorkflow.name,
        description: currentWorkflow.description,
        createdAt: currentWorkflow.created_at,
        nodes,
        edges,
      });

      await saveCurrentWorkflow(workflow);
      const link = createTemplateLink(createTemplatePayload(workflow));
      await navigator.clipboard.writeText(link);
      await trackEvent("share_clicked", {
        workflow_id: workflow.id,
        node_count: workflow.nodes.length,
        edge_count: workflow.edges.length,
        channel: "execution_results",
      });

      setShareStatus({
        type: "success",
        message: "Template link copied. Share it so others can import this workflow.",
      });
    } catch (shareError) {
      const message =
        shareError instanceof Error ? shareError.message : String(shareError);
      setShareStatus({
        type: "error",
        message: `Could not copy template link: ${message}`,
      });
    } finally {
      setIsSharing(false);
    }
  };

  if (!canShare) return null;

  return (
    <div className="mb-3 rounded-md border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Successful run. Share this template while the result is fresh.
        </p>
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSharing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Link2 size={13} />
          )}
          Share Template
        </button>
      </div>
      {shareStatus && (
        <p
          className={`mt-2 text-xs ${
            shareStatus.type === "success" ? "text-green-600" : "text-destructive"
          }`}
        >
          {shareStatus.message}
        </p>
      )}
    </div>
  );
}
