import type { AutomationHealthSnapshot } from "@/types/automation";

interface AutomationHealthSectionProps {
  enabled: boolean;
  snapshot: AutomationHealthSnapshot;
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
        : tone === "danger"
          ? "border-red-500/40 bg-red-500/10 text-red-700"
          : "border-border bg-background text-foreground";

  return (
    <div className={`rounded-md border px-2 py-1.5 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-base font-semibold leading-none">{value}</p>
    </div>
  );
}

export function AutomationHealthSection({
  enabled,
  snapshot,
}: AutomationHealthSectionProps) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Health
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            enabled
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
              : "border border-border bg-background text-muted-foreground"
          }`}
        >
          Runner {enabled ? "On" : "Off"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Active" value={snapshot.active_watches} tone="success" />
        <MetricCard label="Paused" value={snapshot.paused_watches} tone="warning" />
        <MetricCard label="Disabled" value={snapshot.disabled_watches} tone="neutral" />
        <MetricCard label="Failed 24h" value={snapshot.failed_runs_24h} tone="danger" />
      </div>

      <div className="rounded-md border border-border bg-background px-2 py-1.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Successful Runs (24h)
        </p>
        <p className="mt-0.5 text-base font-semibold leading-none text-foreground">
          {snapshot.successful_runs_24h}
        </p>
      </div>
    </section>
  );
}
