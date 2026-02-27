import type { AutomationRun } from "@/types/automation";

export type AppMode = "setup" | "advanced";

export type SetupStep = 1 | 2 | 3;

export type WorkflowChoice = "existing" | "starter";

export interface SetupFlowState {
  step: SetupStep;
  watchPath: string;
  recursive: boolean;
  fileGlob: string;
  workflowChoice: WorkflowChoice;
  workflowId: string | null;
  starterWorkflowId: string | null;
  createdWatchId: string | null;
  lastRun: AutomationRun | null;
  status: "idle" | "creating" | "success" | "error";
  errorMessage: string | null;
  startedAtMs: number;
}
