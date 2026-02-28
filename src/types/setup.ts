import type { AutomationRun } from "@/types/automation";
import type { Workflow } from "@/types/workflow";
import type { StarterRecipeId } from "@/lib/setupRecipes";
import type { FileSortPreview } from "@/lib/tauri";

export type AppMode = "setup" | "advanced";
export type SetupTrack = "organize_files" | "understand_contents";

export type SetupStep = 1 | 2 | 3;

export type WorkflowChoice = "existing" | "starter";
export type SetupErrorStage =
  | "preview_file_sort"
  | "create_watch"
  | "run_watch_now"
  | "starter_workflow";

export interface SetupFlowState {
  step: SetupStep;
  setupTrack: SetupTrack;
  watchPath: string;
  recursive: boolean;
  fileGlob: string;
  destinationPath: string;
  sampleFilePath: string;
  previewResult: FileSortPreview | null;
  previewStatus: "idle" | "loading" | "success" | "error";
  workflowChoice: WorkflowChoice;
  workflowId: string | null;
  starterWorkflowId: string | null;
  starterPresetId: StarterRecipeId;
  customPrompt: string;
  selectedWorkflowSource: WorkflowChoice;
  loadedWorkflowPreview: Workflow | null;
  createdWatchId: string | null;
  lastRun: AutomationRun | null;
  status: "idle" | "creating" | "success" | "error";
  errorMessage: string | null;
  errorStage: SetupErrorStage | null;
  startedAtMs: number;
}
