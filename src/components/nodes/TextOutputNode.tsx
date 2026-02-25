import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

type TextOutputNodeData = Node<{ output?: string }>;

function TextOutputNodeComponent({ data }: NodeProps<TextOutputNodeData>) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm min-w-[250px]">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-card-foreground">
          Text Output
        </span>
      </div>
      <div className="min-h-[60px] rounded-md border border-input bg-muted p-3 text-sm text-muted-foreground whitespace-pre-wrap">
        {(data as Record<string, string>).output || "Output will appear here..."}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-green-500 !border-2 !border-background"
      />
    </div>
  );
}

export const TextOutputNode = memo(TextOutputNodeComponent);
