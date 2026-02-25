import { memo, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";

type CodeJsNodeData = Node<{ code?: string; timeout?: number }>;

function CodeJsNodeComponent({ data, id }: NodeProps<CodeJsNodeData>) {
  const { updateNodeData } = useReactFlow();

  const onCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { code: e.target.value });
    },
    [id, updateNodeData]
  );

  const onTimeoutChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { timeout: parseInt(e.target.value) || 10 });
    },
    [id, updateNodeData]
  );

  const d = data as Record<string, unknown>;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm min-w-[300px]">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
        <span className="text-sm font-medium text-card-foreground">Code (JS)</span>
      </div>
      <textarea
        className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
        placeholder="// input is available as a variable&#10;return input.toUpperCase();"
        value={(d.code as string) ?? ""}
        onChange={onCodeChange}
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Timeout:</span>
        <input
          type="number"
          min={1}
          max={120}
          className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={(d.timeout as number) ?? 10}
          onChange={onTimeoutChange}
        />
        <span className="text-xs text-muted-foreground">sec</span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-purple-500 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-purple-500 !border-2 !border-background"
      />
    </div>
  );
}

export const CodeJsNode = memo(CodeJsNodeComponent);
