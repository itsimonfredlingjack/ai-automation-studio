import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, Loader2, Upload, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useFlowStore } from "@/stores/flowStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { toReactFlowGraph } from "@/lib/reactFlowWorkflow";
import { parseTemplateInput } from "@/lib/templateShare";
import { trackEvent } from "@/lib/analytics";
import * as api from "@/lib/tauri";
import type { Workflow } from "@/types/workflow";
import { TemplateRemixShareCard } from "@/components/layout/TemplateRemixShareCard";
interface StatusState {
  type: "success" | "error";
  message: string;
}

interface RemixContext {
  workflow: Workflow;
  sourceTemplateName: string;
  chainDepth: number;
  rootTemplateName: string;
}
export function TemplateImportSection() {
  const [linkInput, setLinkInput] = useState("");
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [remixContext, setRemixContext] = useState<RemixContext | null>(null);
  const previewTrackedRef = useRef<string | null>(null);
  const { setNodes, setEdges } = useFlowStore();
  const { fetchWorkflows, openWorkflow } = useWorkflowStore();
  const parsedTemplate = useMemo(() => {
    const trimmed = linkInput.trim();
    if (!trimmed) return { payload: null, source: null, error: null as string | null };
    try {
      const parsed = parseTemplateInput(trimmed);
      return { payload: parsed.payload, source: parsed.source, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { payload: null, source: null, error: message };
    }
  }, [linkInput]);

  useEffect(() => {
    if (!parsedTemplate.payload) {
      previewTrackedRef.current = null;
      return;
    }
    const previewKey = linkInput.trim();
    if (!previewKey || previewTrackedRef.current === previewKey) return;
    previewTrackedRef.current = previewKey;
    void trackEvent("invite_preview_viewed", {
      source: "template_link",
      input_source: parsedTemplate.source,
      template_name: parsedTemplate.payload.name,
      node_count: parsedTemplate.payload.nodes.length,
      edge_count: parsedTemplate.payload.edges.length,
      remix_chain_depth: parsedTemplate.payload.remix?.chain_depth ?? 0,
      remix_root_template_name:
        parsedTemplate.payload.remix?.root_template_name ?? parsedTemplate.payload.name,
    });
  }, [linkInput, parsedTemplate.payload, parsedTemplate.source]);

  const handleImport = async () => {
    if (!parsedTemplate.payload || isImporting) return;
    setStatus(null);
    setRemixContext(null);
    setIsImporting(true);
    try {
      const parsed = parsedTemplate.payload;
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
      const chainDepth = (parsed.remix?.chain_depth ?? 0) + 1;
      const rootTemplateName = parsed.remix?.root_template_name ?? parsed.name;
      await trackEvent("invite_accepted", {
        workflow_id: workflowId,
        source: "template_link",
        input_source: parsedTemplate.source,
        template_name: parsed.name,
        node_count: parsed.nodes.length,
        edge_count: parsed.edges.length,
        remix_chain_depth: chainDepth,
        remix_root_template_name: rootTemplateName,
      });
      setLinkInput("");
      setRemixContext({
        workflow,
        sourceTemplateName: parsed.name,
        chainDepth,
        rootTemplateName,
      });
      setStatus({
        type: "success",
        message: `Imported "${importedName}". You're remix #${chainDepth} in this chain.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ type: "error", message: `Could not import template: ${message}` });
    } finally {
      setIsImporting(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    if (isPasting) return;
    setStatus(null);
    setIsPasting(true);
    try {
      const clipboardText = (await navigator.clipboard.readText()).trim();
      if (!clipboardText) throw new Error("Clipboard is empty.");
      setLinkInput(clipboardText);
      setRemixContext(null);
      await trackEvent("invite_link_pasted", { source: "clipboard_button" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ type: "error", message: `Could not read clipboard: ${message}` });
    } finally {
      setIsPasting(false);
    }
  };
  return (
    <>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={linkInput}
          onChange={(event) => {
            setLinkInput(event.target.value);
            setStatus(null);
          }}
          placeholder="Paste invite message or template link..."
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handlePasteFromClipboard}
          disabled={isPasting}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title="Paste template link from clipboard"
        >
          {isPasting ? <Loader2 size={14} className="animate-spin" /> : <Clipboard size={14} />}
        </button>
        <button
          onClick={handleImport}
          disabled={!parsedTemplate.payload || isImporting}
          className="rounded-md bg-primary px-2.5 py-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          title="Import template link"
        >
          {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        </button>
      </div>

      {parsedTemplate.payload && (
        <div className="mt-2 rounded-md border border-border bg-muted/40 px-2.5 py-2">
          <p className="text-xs text-foreground">Ready to import: {parsedTemplate.payload.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {parsedTemplate.payload.nodes.length} nodes, {parsedTemplate.payload.edges.length} connections
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Remix chain #{(parsedTemplate.payload.remix?.chain_depth ?? 0) + 1} · Root:{" "}
            {parsedTemplate.payload.remix?.root_template_name ?? parsedTemplate.payload.name}
          </p>
        </div>
      )}

      {remixContext && (
        <TemplateRemixShareCard remixContext={remixContext} onStatus={setStatus} />
      )}

      {parsedTemplate.error && <p className="mt-2 text-xs text-destructive">{parsedTemplate.error}</p>}

      {status && (
        <div
          className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${
            status.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
          }`}
        >
          {status.type === "success" ? <Check size={12} /> : <X size={12} />}
          <span>{status.message}</span>
        </div>
      )}
    </>
  );
}
