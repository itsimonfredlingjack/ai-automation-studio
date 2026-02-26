import { useEffect, useRef, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { createTemplateInviteMessage } from "@/lib/templateShare";
import { trackEvent } from "@/lib/analytics";
import type { Workflow } from "@/types/workflow";

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

interface TemplateRemixShareCardProps {
  remixContext: RemixContext;
  onStatus: (status: StatusState) => void;
}

export function TemplateRemixShareCard({
  remixContext,
  onStatus,
}: TemplateRemixShareCardProps) {
  const [isSharing, setIsSharing] = useState(false);
  const trackedPromptRef = useRef<string | null>(null);

  useEffect(() => {
    const promptKey = `${remixContext.workflow.id}:${remixContext.sourceTemplateName}`;
    if (trackedPromptRef.current === promptKey) return;
    trackedPromptRef.current = promptKey;
    void trackEvent("remix_prompt_viewed", {
      workflow_id: remixContext.workflow.id,
      source_template_name: remixContext.sourceTemplateName,
      remix_chain_depth: remixContext.chainDepth,
      remix_root_template_name: remixContext.rootTemplateName,
      node_count: remixContext.workflow.nodes.length,
      edge_count: remixContext.workflow.edges.length,
    });
    void trackEvent("remix_chain_prompt_viewed", {
      workflow_id: remixContext.workflow.id,
      remix_chain_depth: remixContext.chainDepth,
      remix_root_template_name: remixContext.rootTemplateName,
    });
  }, [remixContext]);

  const handleShareRemix = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const remixInviteMessage = [
        `I remixed "${remixContext.sourceTemplateName}" in Synapse (Remix #${remixContext.chainDepth}).`,
        createTemplateInviteMessage(remixContext.workflow, {
          remix: {
            chain_depth: remixContext.chainDepth,
            root_template_name: remixContext.rootTemplateName,
          },
        }),
      ].join("\n");
      await navigator.clipboard.writeText(remixInviteMessage);
      await trackEvent("remix_share_clicked", {
        workflow_id: remixContext.workflow.id,
        source_template_name: remixContext.sourceTemplateName,
        remix_chain_depth: remixContext.chainDepth,
        remix_root_template_name: remixContext.rootTemplateName,
        node_count: remixContext.workflow.nodes.length,
        edge_count: remixContext.workflow.edges.length,
        format: "remix_invite_message",
      });
      await trackEvent("remix_chain_share_clicked", {
        workflow_id: remixContext.workflow.id,
        remix_chain_depth: remixContext.chainDepth,
        remix_root_template_name: remixContext.rootTemplateName,
      });
      onStatus({
        type: "success",
        message: `Remix #${remixContext.chainDepth} invite copied. Share it to keep the chain moving.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onStatus({ type: "error", message: `Could not copy remix invite: ${message}` });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="mt-2 rounded-md border border-border bg-secondary/20 px-2.5 py-2">
      <p className="text-xs text-foreground">
        Remix #{remixContext.chainDepth} from "{remixContext.rootTemplateName}". Share yours next.
      </p>
      <button
        onClick={handleShareRemix}
        disabled={isSharing}
        className="mt-2 flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSharing ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
        Share Remix #{remixContext.chainDepth}
      </button>
    </div>
  );
}
