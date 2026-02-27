import type { RecentRunItem } from "@/types/automation";
import { formatRelativeTime } from "@/lib/time";

interface AutomationRecentRunsProps {
  runs: RecentRunItem[];
  workflowNameMap: Map<string, string>;
}

function statusClass(status: RecentRunItem["status"]): string {
  return status === "success"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
    : "border-red-500/40 bg-red-500/10 text-red-700";
}

export function AutomationRecentRuns({
  runs,
  workflowNameMap,
}: AutomationRecentRunsProps) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Recent Runs
      </p>

      {runs.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">
          No automation runs yet.
        </p>
      )}

      {runs.map((run) => (
        <article
          key={run.id}
          className="space-y-1.5 rounded-md border border-border bg-background px-2.5 py-2 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {run.trigger_file_name}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(run.status)}`}
            >
              {run.status}
            </span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {workflowNameMap.get(run.workflow_id) ?? run.workflow_id}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {run.trigger_file_path}
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{run.duration_ms}ms</span>
            <span>{formatRelativeTime(run.ended_at)}</span>
          </div>
          {run.error_message && (
            <p className="line-clamp-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-700">
              {run.error_message}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
