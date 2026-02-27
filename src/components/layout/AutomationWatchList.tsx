import { Pause, Play, Trash2, Ban } from "lucide-react";
import type { AutomationWatch, WatchStatus } from "@/types/automation";

interface AutomationWatchListProps {
  watches: AutomationWatch[];
  workflowNameMap: Map<string, string>;
  enabled: boolean;
  busyWatchId: string | null;
  failureMessages: Record<string, string | null | undefined>;
  onRunNow: (watch: AutomationWatch) => Promise<void>;
  onToggle: (watch: AutomationWatch) => Promise<void>;
  onDisable: (watch: AutomationWatch) => Promise<void>;
  onDelete: (watch: AutomationWatch) => Promise<void>;
  onOpenLastFailure: (watch: AutomationWatch) => Promise<void>;
}

function statusLabel(status: WatchStatus): string {
  return status === "active"
    ? "Active"
    : status === "paused"
      ? "Paused"
      : "Disabled";
}

function statusChipClass(status: WatchStatus): string {
  if (status === "active") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  }
  if (status === "paused") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  }
  return "border-border bg-background text-muted-foreground";
}

export function AutomationWatchList({
  watches,
  workflowNameMap,
  enabled,
  busyWatchId,
  failureMessages,
  onRunNow,
  onToggle,
  onDisable,
  onDelete,
  onOpenLastFailure,
}: AutomationWatchListProps) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Active Watches
      </p>

      {watches.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">
          No watches yet. Create one above to start automating file events.
        </p>
      )}

      {watches.map((watch) => {
        const busy = busyWatchId === watch.id;
        const failureMessage = failureMessages[watch.id];
        return (
          <article
            key={watch.id}
            className="space-y-2 rounded-md border border-border bg-background p-2.5 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {workflowNameMap.get(watch.workflow_id) ?? watch.workflow_id}
                </p>
                <p className="truncate text-muted-foreground">{watch.watch_path}</p>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(watch.status)}`}
              >
                {statusLabel(watch.status)}
              </span>
            </div>

            <p className="truncate text-[11px] text-muted-foreground">
              {watch.file_glob} {watch.recursive ? "· recursive" : ""}
            </p>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => void onRunNow(watch)}
                disabled={busy || !enabled}
                className="rounded-md border border-input px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Run now
              </button>
              <button
                onClick={() => void onToggle(watch)}
                disabled={busy || !enabled}
                className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {watch.status === "active" ? <Pause size={11} /> : <Play size={11} />}
                {watch.status === "active" ? "Pause" : "Resume"}
              </button>
              <button
                onClick={() => void onOpenLastFailure(watch)}
                disabled={busy}
                className="rounded-md border border-input px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Open last failure
              </button>
              <button
                onClick={() => void onDisable(watch)}
                disabled={busy}
                className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Ban size={11} />
                Disable
              </button>
              <button
                onClick={() => void onDelete(watch)}
                disabled={busy}
                className="flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-[11px] text-red-700 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={11} />
                Delete
              </button>
            </div>

            {failureMessage && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800">
                {failureMessage}
              </div>
            )}

            {failureMessage === null && (
              <p className="text-[11px] text-muted-foreground">
                No failed run found for this watch.
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
