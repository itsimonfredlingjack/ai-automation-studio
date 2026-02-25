import { memo, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";

type TextTransformNodeData = Node<{ transform?: string }>;

const TRANSFORMS = ["uppercase", "lowercase", "trim", "reverse"] as const;

function TextTransformNodeComponent({
  data,
  id,
}: NodeProps<TextTransformNodeData>) {
  const { updateNodeData } = useReactFlow();

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { transform: e.target.value });
    },
    [id, updateNodeData]
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm min-w-[250px]">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        <span className="text-sm font-medium text-card-foreground">
          Text Transform
        </span>
      </div>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        value={(data as Record<string, string>).transform ?? "uppercase"}
        onChange={onChange}
      >
        {TRANSFORMS.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-amber-500 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-amber-500 !border-2 !border-background"
      />
    </div>
  );
}

export const TextTransformNode = memo(TextTransformNodeComponent);
