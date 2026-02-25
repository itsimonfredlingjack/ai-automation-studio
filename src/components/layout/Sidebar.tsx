import { useEffect, useState } from "react";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useFlowStore } from "@/stores/flowStore";
import type { Node, Edge } from "@xyflow/react";
import type { Workflow } from "@/types/workflow";
import { Plus, Trash2, Save } from "lucide-react";

export function Sidebar() {
  const {
    workflows,
    currentWorkflowId,
    fetchWorkflows,
    createWorkflow,
    openWorkflow,
    saveCurrentWorkflow,
    deleteWorkflow,
  } = useWorkflowStore();
  const { nodes, edges, setNodes, setEdges } = useFlowStore();
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleCreate = async () => {
    const name = newName.trim() || "Untitled Workflow";
    await createWorkflow(name);
    setNewName("");
    setNodes([]);
    setEdges([]);
  };

  const handleOpen = async (id: string) => {
    const workflow = await openWorkflow(id);
    // Convert workflow nodes/edges to React Flow format
    const rfNodes: Node[] = workflow.nodes.map((n) => ({
      id: n.id,
      type: n.node_type,
      position: { x: n.position.x, y: n.position.y },
      data: n.data as Record<string, unknown>,
    }));
    const rfEdges: Edge[] = workflow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.source_handle ?? undefined,
      targetHandle: e.target_handle ?? undefined,
    }));
    setNodes(rfNodes);
    setEdges(rfEdges);
  };

  const handleSave = async () => {
    if (!currentWorkflowId) return;

    const current = workflows.find((w) => w.id === currentWorkflowId);
    if (!current) return;

    const workflow: Workflow = {
      id: currentWorkflowId,
      name: current.name,
      description: current.description,
      nodes: nodes.map((n) => ({
        id: n.id,
        node_type: n.type ?? "text_input",
        position: { x: n.position.x, y: n.position.y },
        data: n.data as Record<string, unknown>,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle ?? undefined,
        target_handle: e.targetHandle ?? undefined,
      })),
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
    };

    await saveCurrentWorkflow(workflow);
  };

  const handleDelete = async (id: string) => {
    await deleteWorkflow(id);
    if (currentWorkflowId === id) {
      setNodes([]);
      setEdges([]);
    }
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <h1 className="text-lg font-semibold text-foreground">Synapse</h1>
        <p className="text-xs text-muted-foreground">Workflow Automation</p>
      </div>

      {/* Create new workflow */}
      <div className="border-b border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Workflow name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleCreate}
            className="rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 transition-colors"
            title="Create workflow"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Save button */}
      {currentWorkflowId && (
        <div className="border-b border-border p-3">
          <button
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <Save size={14} />
            Save Workflow
          </button>
        </div>
      )}

      {/* Workflow list */}
      <div className="flex-1 overflow-y-auto p-2">
        {workflows.length === 0 ? (
          <p className="p-2 text-center text-xs text-muted-foreground">
            No workflows yet
          </p>
        ) : (
          <ul className="space-y-1">
            {workflows.map((w) => (
              <li
                key={w.id}
                className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer transition-colors ${
                  currentWorkflowId === w.id
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                }`}
                onClick={() => handleOpen(w.id)}
              >
                <span className="truncate">{w.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(w.id);
                  }}
                  className="hidden text-muted-foreground hover:text-destructive group-hover:block"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
