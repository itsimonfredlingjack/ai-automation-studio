import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Loader2, Pause, Play, Trash2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useAutomationStore } from "@/stores/automationStore";
import type { WatchStatus } from "@/types/automation";
import { AutomationSchedulePanel } from "@/components/layout/AutomationSchedulePanel";

export function AutomationPanel() {
  const { workflows } = useWorkflowStore();
  const { enabled, watches, runs, loading, fetchAll, setRunnerEnabled, createWatch, toggleWatch, deleteWatch } =
    useAutomationStore();
  const [workflowId, setWorkflowId] = useState("");
  const [watchPath, setWatchPath] = useState("");
  const [fileGlob, setFileGlob] = useState("*.*");
  const [recursive, setRecursive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchAll();
    const timer = window.setInterval(() => {
      void fetchAll();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchAll]);

  const workflowMap = useMemo(
    () => new Map(workflows.map((workflow) => [workflow.id, workflow.name])),
    [workflows]
  );

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setWatchPath(selected);
    }
  };

  const handleCreate = async () => {
    if (!workflowId || !watchPath.trim() || saving) return;
    setSaving(true);
    try {
      await createWatch({
        workflowId,
        watchPath: watchPath.trim(),
        recursive,
        fileGlob: fileGlob.trim() || "*.*",
      });
      setWatchPath("");
      setFileGlob("*.*");
    } finally {
      setSaving(false);
    }
  };

  const nextStatus = (status: WatchStatus): WatchStatus =>
    status === "active" ? "paused" : "active";

  return (
    <div className="border-b border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Automations
        </p>
        <label className="flex items-center gap-1 text-[11px] text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => void setRunnerEnabled(event.target.checked)}
          />
          Beta
        </label>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
        <select
          value={workflowId}
          onChange={(event) => setWorkflowId(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          <option value="">Select workflow</option>
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <input
            value={watchPath}
            onChange={(event) => setWatchPath(event.target.value)}
            placeholder="Folder path..."
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <button
            onClick={handleBrowse}
            className="rounded-md border border-input bg-background px-2 text-muted-foreground hover:bg-accent/40"
            title="Pick folder"
          >
            <FolderOpen size={12} />
          </button>
        </div>
        <div className="flex gap-1">
          <input
            value={fileGlob}
            onChange={(event) => setFileGlob(event.target.value)}
            placeholder="*.pdf"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <label className="flex items-center gap-1 rounded-md border border-input bg-background px-2 text-[11px]">
            <input
              type="checkbox"
              checked={recursive}
              onChange={(event) => setRecursive(event.target.checked)}
            />
            Rec
          </label>
        </div>
        <button
          onClick={handleCreate}
          disabled={!enabled || !workflowId || !watchPath.trim() || saving}
          className="flex w-full items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Create Watch
        </button>
      </div>

      <div className="mt-2 space-y-1">
        {watches.map((watch) => (
          <div key={watch.id} className="rounded-md border border-border bg-background p-2 text-xs">
            <p className="truncate font-medium">{workflowMap.get(watch.workflow_id) ?? watch.workflow_id}</p>
            <p className="truncate text-muted-foreground">{watch.watch_path}</p>
            <p className="text-[11px] text-muted-foreground">{watch.file_glob} · {watch.status}</p>
            <div className="mt-1 flex gap-1">
              <button
                onClick={() => void toggleWatch(watch.id, nextStatus(watch.status))}
                disabled={!enabled}
                className="rounded-md border border-input px-2 py-0.5 text-[11px]"
              >
                {watch.status === "active" ? <Pause size={11} /> : <Play size={11} />}
              </button>
              <button
                onClick={() => void toggleWatch(watch.id, "disabled")}
                className="rounded-md border border-input px-2 py-0.5 text-[11px]"
              >
                Disable
              </button>
              <button
                onClick={() => void deleteWatch(watch.id)}
                className="rounded-md border border-destructive/40 px-2 py-0.5 text-destructive"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
        {!loading && watches.length === 0 && (
          <p className="text-center text-[11px] text-muted-foreground">
            No automation watches yet.
          </p>
        )}
      </div>

      <div className="mt-2 rounded-md border border-border bg-muted/20 p-2">
        <p className="text-[11px] font-medium text-foreground">Recent runs</p>
        <div className="mt-1 space-y-1">
          {runs.slice(0, 5).map((run) => (
            <p key={run.id} className="truncate text-[11px] text-muted-foreground">
              {run.status} · {run.duration_ms}ms · {run.trigger_file_path}
            </p>
          ))}
          {runs.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No automation runs yet.</p>
          )}
        </div>
      </div>

      <AutomationSchedulePanel workflowMap={workflowMap} />
    </div>
  );
}
