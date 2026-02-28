import { memo, useCallback, useState } from "react";
import {
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { Play, Square, Copy } from "lucide-react";
import * as api from "@/lib/tauri";
import { useWorkflowStore } from "@/stores/workflowStore";

type WebhookTriggerNodeData = Node<{
  port?: number;
  port_mode?: "auto" | "manual";
}>;

const OUTPUT_HANDLES = ["body", "headers", "method", "query"];

function WebhookTriggerNodeComponent({
  data,
  id,
}: NodeProps<WebhookTriggerNodeData>) {
  const { updateNodeData } = useReactFlow();
  const d = data as Record<string, unknown>;
  const port = (d.port as number) ?? 5678;
  const portMode =
    d.port_mode === "manual" || d.port_mode === "auto"
      ? d.port_mode
      : d.port !== undefined
        ? "manual"
        : "auto";
  const { currentWorkflowId } = useWorkflowStore();

  const [isActive, setIsActive] = useState(false);
  const [url, setUrl] = useState("");

  const handleToggle = useCallback(async () => {
    if (!currentWorkflowId) return;

    if (isActive) {
      await api.stopWebhook(currentWorkflowId);
      setIsActive(false);
      setUrl("");
    } else {
      const webhookInfo = await api.startWebhook(
        currentWorkflowId,
        portMode === "manual" ? port : undefined
      );
      setIsActive(true);
      setUrl(webhookInfo.url);
    }
  }, [isActive, currentWorkflowId, port, portMode]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm min-w-[280px]">
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-cyan-500"}`}
        />
        <span className="text-sm font-medium text-card-foreground">
          Webhook Trigger
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={portMode}
            onChange={(e) =>
              updateNodeData(id, {
                port_mode: e.target.value as "auto" | "manual",
              })
            }
            disabled={isActive}
          >
            <option value="auto">Auto port</option>
            <option value="manual">Manual port</option>
          </select>
          <span className="text-xs text-muted-foreground">Port:</span>
          <input
            type="number"
            min={1024}
            max={65535}
            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={port}
            onChange={(e) =>
              updateNodeData(id, { port: parseInt(e.target.value) || 5678 })
            }
            disabled={isActive || portMode === "auto"}
          />
          <button
            onClick={handleToggle}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                : "bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20"
            }`}
          >
            {isActive ? <Square size={12} /> : <Play size={12} />}
            {isActive ? "Stop" : "Start"}
          </button>
        </div>

        {url && (
          <div className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
            <span className="flex-1 truncate text-[10px] font-mono text-muted-foreground">
              {url}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(url)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Copy size={10} />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground pl-1">
          {OUTPUT_HANDLES.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      </div>

      {/* Source handles — one per output */}
      {OUTPUT_HANDLES.map((handle, i) => (
        <Handle
          key={handle}
          type="source"
          position={Position.Right}
          id={handle}
          className="!h-3 !w-3 !bg-cyan-500 !border-2 !border-background"
          style={{
            top: `${((i + 1) / (OUTPUT_HANDLES.length + 1)) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

export const WebhookTriggerNode = memo(WebhookTriggerNodeComponent);
