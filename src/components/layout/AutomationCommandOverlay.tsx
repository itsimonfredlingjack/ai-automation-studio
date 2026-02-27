import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Pause, Play, Search, X } from "lucide-react";
import { useAutomationStore } from "@/stores/automationStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { OPEN_COMMAND_OVERLAY_EVENT } from "@/lib/uiEvents";

function statusChipClass(status: string): string {
  if (status === "active") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  }
  if (status === "paused") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  }
  return "border-border bg-background text-muted-foreground";
}

export function AutomationCommandOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { watches, fetchAll, runWatchNow, getLastFailedRun, toggleWatch } =
    useAutomationStore();
  const { workflows } = useWorkflowStore();

  useEffect(() => {
    const onOpenRequested = () => setOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "Space") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener(OPEN_COMMAND_OVERLAY_EVENT, onOpenRequested);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_COMMAND_OVERLAY_EVENT, onOpenRequested);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchAll();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [fetchAll, open]);

  const workflowNames = useMemo(
    () => new Map(workflows.map((workflow) => [workflow.id, workflow.name])),
    [workflows]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return watches;
    return watches.filter((watch) => {
      const content = `${workflowNames.get(watch.workflow_id) ?? ""} ${
        watch.watch_path
      } ${watch.file_glob}`.toLowerCase();
      return content.includes(term);
    });
  }, [query, watches, workflowNames]);

  const handleRunNow = async (watchId: string) => {
    setBusyId(watchId);
    setStatusText(null);
    try {
      const run = await runWatchNow(watchId);
      setStatusText(
        run.status === "success"
          ? `Run completed in ${run.duration_ms}ms`
          : `Run failed: ${run.error_message ?? "Unknown error"}`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (watchId: string, currentStatus: string) => {
    setBusyId(watchId);
    try {
      const next = currentStatus === "active" ? "paused" : "active";
      await toggleWatch(watchId, next);
      setStatusText(next === "active" ? "Watch resumed." : "Watch paused.");
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenLastFailure = async (watchId: string) => {
    setBusyId(watchId);
    try {
      const failed = await getLastFailedRun(watchId);
      setStatusText(
        failed?.error_message
          ? `Last failure: ${failed.error_message}`
          : "No failed run found for this watch."
      );
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/45 p-6 backdrop-blur-[1px]">
      <div className="mt-8 w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Automation Commands
            </p>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/40"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5">
            <Search size={14} className="text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by workflow, folder, or glob"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto p-3">
          {filtered.map((watch) => (
            <div
              key={watch.id}
              className="mb-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {workflowNames.get(watch.workflow_id) ?? watch.workflow_id}
                  </p>
                  <p className="truncate text-muted-foreground">{watch.watch_path}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {watch.file_glob}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(watch.status)}`}
                >
                  {watch.status}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => void handleRunNow(watch.id)}
                  disabled={busyId === watch.id}
                  className="rounded-md border border-input px-2 py-1 transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Run now
                </button>
                <button
                  onClick={() => void handleToggle(watch.id, watch.status)}
                  disabled={busyId === watch.id}
                  className="flex items-center gap-1 rounded-md border border-input px-2 py-1 transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {watch.status === "active" ? <Pause size={11} /> : <Play size={11} />}
                  {watch.status === "active" ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => void handleOpenLastFailure(watch.id)}
                  disabled={busyId === watch.id}
                  className="rounded-md border border-input px-2 py-1 transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Open last failure
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              Search by workflow, folder, or glob.
            </p>
          )}
        </div>

        {statusText && (
          <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs">
            <AlertCircle size={12} className="text-muted-foreground" />
            <span className="truncate">{statusText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
