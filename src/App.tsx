import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useAiSystemStore } from "@/stores/aiSystemStore";
import { SetupModeHeader } from "@/components/layout/SetupModeHeader";
import { SetupWorkspace } from "@/components/layout/SetupWorkspace";
import { AdvancedWorkspace } from "@/components/layout/AdvancedWorkspace";
import { trackEvent } from "@/lib/analytics";
import type { AppMode } from "@/types/setup";

const APP_MODE_STORAGE_KEY = "synapse.app_mode";

function readStoredMode(): AppMode {
  if (typeof window === "undefined") {
    return "setup";
  }
  const stored = window.localStorage.getItem(APP_MODE_STORAGE_KEY);
  return stored === "advanced" ? "advanced" : "setup";
}

function App() {
  const { startPolling, stopPolling } = useAiSystemStore();
  const [mode, setMode] = useState<AppMode>(() => readStoredMode());
  const previousModeRef = useRef<AppMode>(mode);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const handleModeChange = useCallback((nextMode: AppMode) => {
    setMode((currentMode) => {
      if (currentMode === nextMode) {
        return currentMode;
      }
      window.localStorage.setItem(APP_MODE_STORAGE_KEY, nextMode);
      return nextMode;
    });
  }, []);

  useEffect(() => {
    if (previousModeRef.current !== mode) {
      void trackEvent("setup_mode_switched", { to_mode: mode });
      previousModeRef.current = mode;
    }
  }, [mode]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <SetupModeHeader mode={mode} onModeChange={handleModeChange} />
        <main className="flex-1 overflow-hidden">
          {mode === "setup" ? (
            <SetupWorkspace onOpenAdvanced={() => handleModeChange("advanced")} />
          ) : (
            <AdvancedWorkspace />
          )}
        </main>
      </div>
    </ReactFlowProvider>
  );
}

export default App;
