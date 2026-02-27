import { countNonGptOssConfigured } from "@/lib/aiUsage";
import { GptOssSystemBadge } from "@/components/layout/GptOssSystemBadge";
import { useFlowStore } from "@/stores/flowStore";
import type { AppMode } from "@/types/setup";

interface SetupModeHeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function SetupModeHeader({ mode, onModeChange }: SetupModeHeaderProps) {
  const { nodes } = useFlowStore();
  const nonGptOssCount = countNonGptOssConfigured(nodes);

  const buttonClass = (value: AppMode) =>
    value === mode
      ? "bg-primary text-primary-foreground"
      : "bg-background text-foreground hover:bg-accent/40";

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div>
        <p className="text-base font-semibold text-foreground">Synapse</p>
        <p className="text-xs text-muted-foreground">
          Simple setup first. Advanced builder when you need it.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="rounded-md border border-border bg-muted/20 p-1">
          <button
            onClick={() => onModeChange("setup")}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${buttonClass("setup")}`}
          >
            Setup
          </button>
          <button
            onClick={() => onModeChange("advanced")}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${buttonClass("advanced")}`}
          >
            Advanced
          </button>
        </div>
        <GptOssSystemBadge compact warnCount={nonGptOssCount} />
      </div>
    </header>
  );
}
