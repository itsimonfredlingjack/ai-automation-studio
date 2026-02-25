import { NODE_PALETTE } from "@/components/nodes/nodeTypes";

export function NodePalette() {
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: string
  ) => {
    event.dataTransfer.setData("application/synapse-node", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-md">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Nodes
      </span>
      {NODE_PALETTE.map((item) => (
        <div
          key={item.type}
          draggable
          onDragStart={(e) => onDragStart(e, item.type)}
          className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent active:cursor-grabbing"
          title={item.description}
        >
          <div className={`h-2 w-2 rounded-full ${item.color}`} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
