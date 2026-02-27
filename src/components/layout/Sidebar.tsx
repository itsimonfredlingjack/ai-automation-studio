import { useEffect, useMemo, useState } from "react";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useFlowStore } from "@/stores/flowStore";
import { useAutomationStore } from "@/stores/automationStore";
import type { Workflow } from "@/types/workflow";
import { Plus, Trash2, Save, ChevronDown, ChevronRight } from "lucide-react";
import { toReactFlowGraph } from "@/lib/reactFlowWorkflow";
import { buildWorkflowPayload } from "@/lib/workflowPayload";
import { TemplateSharePanel } from "@/components/layout/TemplateSharePanel";
import { AutomationPanel } from "@/components/layout/AutomationPanel";
import { countNonGptOssConfigured } from "@/lib/aiUsage";
import { GptOssSystemBadge } from "@/components/layout/GptOssSystemBadge";

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
  const { enabled, setRunnerEnabled, getHealthSnapshot } = useAutomationStore();
  const { nodes, edges, setNodes, setEdges } = useFlowStore();
  const [newName, setNewName] = useState("");
  const [workflowQuery, setWorkflowQuery] = useState("");
  const [workflowLibraryOpen, setWorkflowLibraryOpen] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const healthSnapshot = getHealthSnapshot();
  const nonGptOssCount = countNonGptOssConfigured(nodes);

  const filteredWorkflows = useMemo(() => {
    const query = workflowQuery.trim().toLowerCase();
    if (!query) {
      return workflows;
    }
    return workflows.filter((workflow) =>
      workflow.name.toLowerCase().includes(query)
    );
  }, [workflowQuery, workflows]);

  const handleCreate = async () => {
    const name = newName.trim() || "Untitled Workflow";
    await createWorkflow(name);
    setNewName("");
    setNodes([]);
    setEdges([]);
  };

  const handleOpen = async (id: string) => {
    const workflow = await openWorkflow(id);
    const graph = toReactFlowGraph(workflow);
    setNodes(graph.nodes);
    setEdges(graph.edges);
  };

  const handleSave = async () => {
    if (!currentWorkflowId) return;

    const current = workflows.find((w) => w.id === currentWorkflowId);
    if (!current) return;

    const workflow: Workflow = buildWorkflowPayload({
      workflowId: currentWorkflowId,
      name: current.name,
      description: current.description,
      createdAt: current.created_at,
      nodes,
      edges,
    });
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
    <aside className="flex h-full w-80 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">Synapse</h1>
        <p className="text-xs text-muted-foreground">
          Automation Command Center
        </p>
        <div className="mt-2">
          <GptOssSystemBadge warnCount={nonGptOssCount} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Runner
          </p>
          <p className="text-[11px] text-muted-foreground">
            {healthSnapshot.active_watches} active watches
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => void setRunnerEnabled(event.target.checked)}
          />
          Enable (Beta)
        </label>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Automation Command Center
          </p>
          <AutomationPanel />
        </section>

        <section className="rounded-lg border border-border bg-muted/20">
          <button
            onClick={() => setWorkflowLibraryOpen((value) => !value)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Workflow Library
            </span>
            {workflowLibraryOpen ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
          </button>

          {workflowLibraryOpen && (
            <div className="space-y-2 border-t border-border px-3 py-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Workflow name..."
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) =>
                    event.key === "Enter" && void handleCreate()
                  }
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={() => void handleCreate()}
                  className="rounded-md bg-primary px-2 text-primary-foreground transition-colors hover:bg-primary/90"
                  title="Create workflow"
                >
                  <Plus size={14} />
                </button>
              </div>

              <input
                type="text"
                value={workflowQuery}
                onChange={(event) => setWorkflowQuery(event.target.value)}
                placeholder="Search workflows..."
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />

              {currentWorkflowId && (
                <button
                  onClick={() => void handleSave()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-secondary px-2 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  <Save size={12} />
                  Save Workflow
                </button>
              )}

              <div className="max-h-52 overflow-y-auto">
                {filteredWorkflows.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-2 py-2 text-center text-xs text-muted-foreground">
                    No workflows found.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredWorkflows.map((workflow) => (
                      <li
                        key={workflow.id}
                        className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
                          currentWorkflowId === workflow.id
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-accent/40"
                        }`}
                        onClick={() => void handleOpen(workflow.id)}
                      >
                        <span className="truncate">{workflow.name}</span>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDelete(workflow.id);
                          }}
                          className="text-muted-foreground/80 transition-colors hover:text-destructive"
                          title="Delete workflow"
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-muted/20">
          <button
            onClick={() => setTemplateOpen((value) => !value)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Template Share
            </span>
            {templateOpen ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
          </button>
          {templateOpen && (
            <div className="border-t border-border px-0 py-0">
              <TemplateSharePanel />
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
