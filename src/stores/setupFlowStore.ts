import { create } from "zustand";
import type { AutomationRun } from "@/types/automation";
import type { SetupFlowState, SetupStep, WorkflowChoice } from "@/types/setup";

function nowMs(): number {
  return Date.now();
}

export function createInitialSetupFlowState(): SetupFlowState {
  return {
    step: 1,
    watchPath: "",
    recursive: true,
    fileGlob: "*.*",
    workflowChoice: "existing",
    workflowId: null,
    starterWorkflowId: null,
    createdWatchId: null,
    lastRun: null,
    status: "idle",
    errorMessage: null,
    startedAtMs: nowMs(),
  };
}

export function canContinueStep1(state: SetupFlowState): boolean {
  return state.watchPath.trim().length > 0;
}

export function canContinueStep2(state: SetupFlowState): boolean {
  return Boolean(state.workflowId);
}

interface SetupFlowStore extends SetupFlowState {
  setStep: (step: SetupStep) => void;
  goNext: () => void;
  goBack: () => void;
  setWatchPath: (value: string) => void;
  setRecursive: (value: boolean) => void;
  setFileGlob: (value: string) => void;
  setWorkflowChoice: (value: WorkflowChoice) => void;
  setWorkflowId: (value: string | null) => void;
  setStarterWorkflowId: (value: string | null) => void;
  setCreatedWatchId: (value: string | null) => void;
  startCreate: () => void;
  finishCreate: (run: AutomationRun, watchId: string) => void;
  failCreate: (message: string) => void;
  restart: () => void;
}

export const useSetupFlowStore = create<SetupFlowStore>((set, get) => ({
  ...createInitialSetupFlowState(),

  setStep: (step) => set({ step }),

  goNext: () =>
    set((current) => ({
      step: Math.min(3, current.step + 1) as SetupStep,
    })),

  goBack: () =>
    set((current) => ({
      step: Math.max(1, current.step - 1) as SetupStep,
    })),

  setWatchPath: (value) => set({ watchPath: value }),
  setRecursive: (value) => set({ recursive: value }),
  setFileGlob: (value) => set({ fileGlob: value }),

  setWorkflowChoice: (value) => {
    const currentWorkflowId = get().workflowId;
    const shouldResetWorkflow =
      value === "starter" && currentWorkflowId && !get().starterWorkflowId;
    set({
      workflowChoice: value,
      workflowId: shouldResetWorkflow ? null : currentWorkflowId,
    });
  },

  setWorkflowId: (value) => set({ workflowId: value }),
  setStarterWorkflowId: (value) => set({ starterWorkflowId: value }),
  setCreatedWatchId: (value) => set({ createdWatchId: value }),

  startCreate: () => set({ status: "creating", errorMessage: null }),

  finishCreate: (run, watchId) =>
    set({
      status: run.status === "success" ? "success" : "error",
      errorMessage: run.status === "error" ? run.error_message ?? "Run failed" : null,
      lastRun: run,
      createdWatchId: watchId,
      step: 3,
    }),

  failCreate: (message) =>
    set({
      status: "error",
      errorMessage: message,
    }),

  restart: () => set(createInitialSetupFlowState()),
}));
