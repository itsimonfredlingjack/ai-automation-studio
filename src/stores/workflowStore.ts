import { create } from "zustand";
import type { Workflow, WorkflowMetadata } from "@/types/workflow";
import * as api from "@/lib/tauri";
import { v4 as uuidv4 } from "uuid";

interface WorkflowStore {
  workflows: WorkflowMetadata[];
  currentWorkflowId: string | null;
  loading: boolean;

  fetchWorkflows: () => Promise<void>;
  createWorkflow: (name: string) => Promise<string>;
  openWorkflow: (id: string) => Promise<Workflow>;
  saveCurrentWorkflow: (workflow: Workflow) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflows: [],
  currentWorkflowId: null,
  loading: false,

  fetchWorkflows: async () => {
    set({ loading: true });
    try {
      const workflows = await api.listWorkflows();
      set({ workflows, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createWorkflow: async (name: string) => {
    const workflow: Workflow = {
      id: uuidv4(),
      name,
      nodes: [],
      edges: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await api.saveWorkflow(workflow);
    await get().fetchWorkflows();
    set({ currentWorkflowId: workflow.id });
    return workflow.id;
  },

  openWorkflow: async (id: string) => {
    const workflow = await api.loadWorkflow(id);
    set({ currentWorkflowId: id });
    return workflow;
  },

  saveCurrentWorkflow: async (workflow: Workflow) => {
    await api.saveWorkflow(workflow);
    await get().fetchWorkflows();
  },

  deleteWorkflow: async (id: string) => {
    await api.deleteWorkflow(id);
    const { currentWorkflowId } = get();
    if (currentWorkflowId === id) {
      set({ currentWorkflowId: null });
    }
    await get().fetchWorkflows();
  },
}));
