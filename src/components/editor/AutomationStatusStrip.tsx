import { Command } from "lucide-react";
import { useAutomationStore } from "@/stores/automationStore";
import { OPEN_COMMAND_OVERLAY_EVENT } from "@/lib/uiEvents";
import { useFlowStore } from "@/stores/flowStore";
import { countNonGptOssConfigured } from "@/lib/aiUsage";
import { GptOssSystemBadge } from "@/components/layout/GptOssSystemBadge";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function AutomationStatusStrip() {
  const { enabled, getHealthSnapshot } = useAutomationStore();
  const { nodes } = useFlowStore();
  const snapshot = getHealthSnapshot();
  const nonGptOssCount = countNonGptOssConfigured(nodes);

  const handleOpenOverlay = () => {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_OVERLAY_EVENT));
  };

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/25 px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <GptOssSystemBadge compact warnCount={nonGptOssCount} />
        <Stat label="Runner" value={enabled ? "On" : "Off"} />
        <Stat label="Active Watches" value={snapshot.active_watches} />
        <Stat label="Success 24h" value={snapshot.successful_runs_24h} />
        <Stat label="Failed 24h" value={snapshot.failed_runs_24h} />
      </div>

      <button
        onClick={handleOpenOverlay}
        className="flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent/40"
      >
        <Command size={12} />
        Open Command Overlay
        <span className="text-[10px] text-muted-foreground">Ctrl/Cmd+Space</span>
      </button>
    </div>
  );
}
