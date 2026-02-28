import { create } from "zustand";
import type { AutomationRun } from "@/types/automation";
import {
  DEFAULT_STARTER_RECIPE_ID,
  getStarterRecipeById,
  type StarterRecipeId,
} from "@/lib/setupRecipes";
import type {
  SetupErrorStage,
  SetupFlowState,
  SetupStep,
  SetupTrack,
  WorkflowChoice,
} from "@/types/setup";
import type { Workflow } from "@/types/workflow";
import type { FileSortPreview } from "@/lib/tauri";

function nowMs(): number {
  return Date.now();
}

export function createInitialSetupFlowState(): SetupFlowState {
  const starterRecipe = getStarterRecipeById(DEFAULT_STARTER_RECIPE_ID);
  return {
    step: 1,
    setupTrack: "organize_files",
    watchPath: "",
    recursive: true,
    fileGlob: "*.*",
    destinationPath: "",
    sampleFilePath: "",
    previewResult: null,
    previewStatus: "idle",
    workflowChoice: "existing",
    workflowId: null,
    starterWorkflowId: null,
    starterPresetId: starterRecipe.id,
    customPrompt: starterRecipe.prompt,
    selectedWorkflowSource: "existing",
    loadedWorkflowPreview: null,
    createdWatchId: null,
    lastRun: null,
    status: "idle",
    errorMessage: null,
    errorStage: null,
    startedAtMs: nowMs(),
  };
}

export function canContinueStep1(state: SetupFlowState): boolean {
  return state.watchPath.trim().length > 0;
}

export function canContinueStep2(state: SetupFlowState): boolean {
  if (state.setupTrack === "organize_files") {
    return state.destinationPath.trim().length > 0;
  }
  return Boolean(state.workflowId);
}

interface SetupFlowStore extends SetupFlowState {
  setStep: (step: SetupStep) => void;
  goNext: () => void;
  goBack: () => void;
  setWatchPath: (value: string) => void;
  setRecursive: (value: boolean) => void;
  setFileGlob: (value: string) => void;
  setSetupTrack: (value: SetupTrack) => void;
  setDestinationPath: (value: string) => void;
  setSampleFilePath: (value: string) => void;
  setPreviewResult: (value: FileSortPreview | null) => void;
  setPreviewStatus: (value: "idle" | "loading" | "success" | "error") => void;
  setWorkflowChoice: (value: WorkflowChoice) => void;
  setWorkflowId: (value: string | null) => void;
  setStarterWorkflowId: (value: string | null) => void;
  setStarterPresetId: (value: StarterRecipeId) => void;
  setCustomPrompt: (value: string) => void;
  setLoadedWorkflowPreview: (value: Workflow | null) => void;
  setCreatedWatchId: (value: string | null) => void;
  setErrorStage: (value: SetupErrorStage | null) => void;
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

  setWatchPath: (value) =>
    set({
      watchPath: value,
      previewResult: null,
      previewStatus: "idle",
    }),
  setRecursive: (value) => set({ recursive: value }),
  setFileGlob: (value) =>
    set({
      fileGlob: value,
      previewResult: null,
      previewStatus: "idle",
    }),
  setSetupTrack: (value) =>
    set({
      setupTrack: value,
      previewResult: null,
      previewStatus: "idle",
      errorMessage: null,
      errorStage: null,
    }),
  setDestinationPath: (value) =>
    set({
      destinationPath: value,
      previewResult: null,
      previewStatus: "idle",
    }),
  setSampleFilePath: (value) =>
    set({
      sampleFilePath: value,
      previewResult: null,
      previewStatus: "idle",
    }),
  setPreviewResult: (value) =>
    set({
      previewResult: value,
      previewStatus: value ? "success" : "idle",
    }),
  setPreviewStatus: (value) => set({ previewStatus: value }),

  setWorkflowChoice: (value) => {
    const currentWorkflowId = get().workflowId;
    const starterWorkflowId = get().starterWorkflowId;
    const shouldResetWorkflow =
      value === "starter" && currentWorkflowId && !get().starterWorkflowId;
    set({
      workflowChoice: value,
      selectedWorkflowSource: value,
      workflowId:
        value === "starter"
          ? starterWorkflowId ?? (shouldResetWorkflow ? null : currentWorkflowId)
          : currentWorkflowId,
    });
  },

  setWorkflowId: (value) => set({ workflowId: value }),
  setStarterWorkflowId: (value) => set({ starterWorkflowId: value }),
  setStarterPresetId: (value) =>
    set((current) => {
      const recipe = getStarterRecipeById(value);
      const currentRecipe = getStarterRecipeById(current.starterPresetId);
      const shouldReplacePrompt =
        !current.customPrompt.trim() || current.customPrompt === currentRecipe.prompt;
      return {
        starterPresetId: value,
        customPrompt: shouldReplacePrompt ? recipe.prompt : current.customPrompt,
      };
    }),
  setCustomPrompt: (value) => set({ customPrompt: value }),
  setLoadedWorkflowPreview: (value) => set({ loadedWorkflowPreview: value }),
  setCreatedWatchId: (value) => set({ createdWatchId: value }),
  setErrorStage: (value) => set({ errorStage: value }),

  startCreate: () => set({ status: "creating", errorMessage: null }),

  finishCreate: (run, watchId) =>
    set({
      status: run.status === "success" ? "success" : "error",
      errorMessage: run.status === "error" ? run.error_message ?? "Run failed" : null,
      lastRun: run,
      createdWatchId: watchId,
      errorStage: run.status === "error" ? "run_watch_now" : null,
      step: 3,
    }),

  failCreate: (message) =>
    set({
      status: "error",
      errorMessage: message,
    }),

  restart: () => set(createInitialSetupFlowState()),
}));
