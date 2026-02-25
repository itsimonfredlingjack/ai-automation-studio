import { memo } from "react";
import {
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";

type WebhookRespondNodeData = Node<{
  status_code?: number;
  content_type?: string;
}>;

function WebhookRespondNodeComponent({
  data,
  id,
}: NodeProps<WebhookRespondNodeData>) {
  const { updateNodeData } = useReactFlow();
  const d = data as Record<string, unknown>;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm min-w-[220px]">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-teal-500" />
        <span className="text-sm font-medium text-card-foreground">
          Respond Webhook
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <input
            type="number"
            min={100}
            max={599}
            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={(d.status_code as number) ?? 200}
            onChange={(e) =>
              updateNodeData(id, {
                status_code: parseInt(e.target.value) || 200,
              })
            }
          />
        </div>

        <select
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={(d.content_type as string) ?? "application/json"}
          onChange={(e) =>
            updateNodeData(id, { content_type: e.target.value })
          }
        >
          <option value="application/json">application/json</option>
          <option value="text/plain">text/plain</option>
          <option value="text/html">text/html</option>
        </select>
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-teal-500 !border-2 !border-background"
      />
    </div>
  );
}

export const WebhookRespondNode = memo(WebhookRespondNodeComponent);
