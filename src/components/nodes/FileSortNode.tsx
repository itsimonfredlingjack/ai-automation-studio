import { memo, useCallback } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";

type FileSortNodeData = Node<{
  destination_path?: string;
  operation?: "move";
  conflict_policy?: "keep_both";
}>;

function FileSortNodeComponent({ data, id }: NodeProps<FileSortNodeData>) {
  const { updateNodeData } = useReactFlow();
  const nodeData = data as Record<string, unknown>;

  const update = useCallback(
    (field: string, value: unknown) => {
      updateNodeData(id, { [field]: value });
    },
    [id, updateNodeData]
  );

  return (
    <div className="min-w-[290px] rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
        <span className="text-sm font-medium text-card-foreground">File Sort</span>
      </div>

      <div className="space-y-2">
        <input
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Destination folder"
          value={(nodeData.destination_path as string) ?? ""}
          onChange={(event) => update("destination_path", event.target.value)}
        />

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground">
            Action: {(nodeData.operation as string) ?? "move"}
          </div>
          <div className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground">
            Conflict: {(nodeData.conflict_policy as string) ?? "keep_both"}
          </div>
        </div>

        <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-700">
          Moves matching trigger files into one fixed destination folder.
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-sky-500 !border-2 !border-background"
      />
    </div>
  );
}

export const FileSortNode = memo(FileSortNodeComponent);
