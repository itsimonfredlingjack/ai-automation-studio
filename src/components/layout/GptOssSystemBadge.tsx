import { Cpu, AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { useAiSystemStore } from "@/stores/aiSystemStore";
import { formatHealthAge, mapGptOssStatusToDisplay } from "@/lib/gptOssStatus";

interface GptOssSystemBadgeProps {
  warnCount: number;
  compact?: boolean;
}

function toneClass(tone: "success" | "warning" | "danger"): string {
  if (tone === "success") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  }
  if (tone === "warning") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  }
  return "border-red-500/40 bg-red-500/10 text-red-700";
}

export function GptOssSystemBadge({
  warnCount,
  compact = false,
}: GptOssSystemBadgeProps) {
  const { status, loading, lastCheckedAt } = useAiSystemStore();
  const display = mapGptOssStatusToDisplay(status);
  const checkedAgo = formatHealthAge(lastCheckedAt);

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${toneClass(display.tone)}`}
      >
        {display.tone === "danger" ? <WifiOff size={12} /> : <Cpu size={12} />}
        <span className="font-medium">GPT-OSS</span>
        {loading && <Loader2 size={11} className="animate-spin" />}
        {warnCount > 0 && (
          <span className="rounded-full border border-current/40 px-1 py-0 text-[10px]">
            {warnCount} mixed
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-xs ${toneClass(display.tone)}`}
    >
      <div className="flex items-center gap-2">
        {display.tone === "danger" ? <WifiOff size={14} /> : <Cpu size={14} />}
        <p className="font-semibold">{display.headline}</p>
        {loading && <Loader2 size={12} className="animate-spin" />}
      </div>
      <p className="mt-1 truncate text-[11px]">{display.detail}</p>
      <div className="mt-1 flex items-center gap-2 text-[10px]">
        <span>Last checked {checkedAgo}</span>
        {warnCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <AlertTriangle size={10} />
            {warnCount} non GPT-OSS node{warnCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
