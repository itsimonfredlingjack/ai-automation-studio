import { memo, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";

type TextInputNodeData = Node<{ text?: string }>;

function TextInputNodeComponent({ data, id }: NodeProps<TextInputNodeData>) {
  const { updateNodeData } = useReactFlow();

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
    },
    [id, updateNodeData]
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm min-w-[250px]">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
        <span className="text-sm font-medium text-card-foreground">
          Text Input
        </span>
      </div>
      <textarea
        className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        placeholder="Enter text..."
        value={(data as Record<string, string>).text ?? ""}
        onChange={onChange}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-blue-500 !border-2 !border-background"
      />
    </div>
  );
}

export const TextInputNode = memo(TextInputNodeComponent);
