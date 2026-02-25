import { useMemo, useState } from "react";
import { Check, Link2, Upload, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useFlowStore } from "@/stores/flowStore";
import { buildWorkflowPayload } from "@/lib/workflowPayload";
import { toReactFlowGraph } from "@/lib/reactFlowWorkflow";
import { createTemplateLink, createTemplatePayload, parseTemplateLink } from "@/lib/templateShare";
import { trackEvent } from "@/lib/analytics";
import * as api from "@/lib/tauri";
import type { Workflow } from "@/types/workflow";

interface StatusState {
  type: "success" | "error";
  message: string;
}

export function TemplateSharePanel() {
  const [linkInput, setLinkInput] = useState("");
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { nodes, edges, setNodes, setEdges } = useFlowStore();
  const {
    currentWorkflowId,
    workflows,
    saveCurrentWorkflow,
    fetchWorkflows,
    openWorkflow,
  } = useWorkflowStore();

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

      const link = createTemplateLink(createTemplatePayload(workflow));
      await navigator.clipboard.writeText(link);
      await trackEvent("share_clicked", {
        workflow_id: workflow.id,
        node_count: workflow.nodes.length,
        edge_count: workflow.edges.length,
        channel: "copy_link",
      });

      setStatus({ type: "success", message: "Template link copied to clipboard." });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ type: "error", message: `Could not copy template link: ${message}` });
    } finally {
      setIsSharing(false);
    }
  };

  const handleImport = async () => {
    if (!linkInput.trim() || isImporting) {
      return;
    }

    setStatus(null);
    setIsImporting(true);

    try {
      const parsed = parseTemplateLink(linkInput);
      const workflowId = uuidv4();
      const importedName = `${parsed.name} (copy)`;
      const now = new Date().toISOString();
      const workflow: Workflow = {
        id: workflowId,
        name: importedName,
        nodes: parsed.nodes,
        edges: parsed.edges,
        created_at: now,
        updated_at: now,
      };

      await api.saveWorkflow(workflow);
      await fetchWorkflows();

      const opened = await openWorkflow(workflowId);
      const graph = toReactFlowGraph(opened);
      setNodes(graph.nodes);
      setEdges(graph.edges);

      await trackEvent("invite_accepted", {
        workflow_id: workflowId,
        source: "template_link",
        node_count: parsed.nodes.length,
        edge_count: parsed.edges.length,
      });

      setLinkInput("");
      setStatus({ type: "success", message: `Imported "${importedName}".` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ type: "error", message: `Could not import template: ${message}` });
    } finally {
      setIsImporting(false);
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

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={linkInput}
          onChange={(event) => setLinkInput(event.target.value)}
          placeholder="Paste template link..."
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleImport}
          disabled={!linkInput.trim() || isImporting}
          className="rounded-md bg-primary px-2.5 py-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          title="Import template link"
        >
          <Upload size={14} />
        </button>
      </div>

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
