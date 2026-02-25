import { create } from "zustand";

export interface NodeStepResult {
  node_id: string;
  node_type: string;
  outputs: Record<string, unknown>;
  duration_ms: number;
}

export interface ExecutionResult {
  final_outputs: Record<string, unknown>;
  steps: NodeStepResult[];
  total_duration_ms: number;
}

interface ExecutionStore {
  isRunning: boolean;
  mode: "execute" | "test" | null;
  result: ExecutionResult | null;
  error: string | null;
  showResults: boolean;

  startExecution: (mode: "execute" | "test") => void;
  setResult: (result: ExecutionResult) => void;
  setError: (error: string) => void;
  reset: () => void;
  toggleResults: () => void;
  closeResults: () => void;
}

export const useExecutionStore = create<ExecutionStore>((set) => ({
  isRunning: false,
  mode: null,
  result: null,
  error: null,
  showResults: false,

  startExecution: (mode) =>
    set({ isRunning: true, mode, result: null, error: null, showResults: false }),

  setResult: (result) =>
    set({ isRunning: false, result, error: null, showResults: true }),

  setError: (error) =>
    set({ isRunning: false, error, showResults: true }),

  reset: () =>
    set({
      isRunning: false,
      mode: null,
      result: null,
      error: null,
      showResults: false,
    }),

  toggleResults: () => set((s) => ({ showResults: !s.showResults })),
  closeResults: () => set({ showResults: false }),
}));
