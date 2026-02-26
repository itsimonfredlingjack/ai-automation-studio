import { useMemo, useState } from "react";
import { Check, Link2, X } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useFlowStore } from "@/stores/flowStore";
import { buildWorkflowPayload } from "@/lib/workflowPayload";
import { createTemplateInviteMessage } from "@/lib/templateShare";
import { trackEvent } from "@/lib/analytics";
import { TemplateImportSection } from "@/components/layout/TemplateImportSection";

interface StatusState {
  type: "success" | "error";
  message: string;
}

export function TemplateSharePanel() {
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const { nodes, edges } = useFlowStore();
  const { currentWorkflowId, workflows, saveCurrentWorkflow } = useWorkflowStore();

  const currentWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === currentWorkflowId) ?? null,
    [workflows, currentWorkflowId]
  );

  const canShare = Boolean(currentWorkflowId && currentWorkflow && nodes.length > 0);

  const handleShare = async () => {
    if (!currentWorkflowId || !currentWorkflow || isSharing) {
      return;
    }

    setStatus(null);
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
      const inviteMessage = createTemplateInviteMessage(workflow);
      await navigator.clipboard.writeText(inviteMessage);
      await trackEvent("share_invite_copied", {
        workflow_id: workflow.id,
        node_count: workflow.nodes.length,
        edge_count: workflow.edges.length,
        format: "invite_message",
      });
      await trackEvent("share_clicked", {
        workflow_id: workflow.id,
        node_count: workflow.nodes.length,
        edge_count: workflow.edges.length,
        channel: "invite_message",
      });

      setStatus({
        type: "success",
        message: "Invite message copied. Share it in chat; recipients can paste it directly here.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ type: "error", message: `Could not copy template link: ${message}` });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="border-b border-border p-3">
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          disabled={!canShare || isSharing}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSharing ? <Check size={14} className="animate-pulse" /> : <Link2 size={14} />}
          Share Template
        </button>
      </div>

      <TemplateImportSection />

      {status && (
        <div
          className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${
            status.type === "success"
              ? "bg-green-500/10 text-green-600"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {status.type === "success" ? <Check size={12} /> : <X size={12} />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
