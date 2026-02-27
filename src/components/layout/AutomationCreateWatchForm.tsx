import { useState } from "react";
import { FolderOpen, Loader2, Plus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { WorkflowMetadata } from "@/types/workflow";

interface CreateWatchValues {
  workflowId: string;
  watchPath: string;
  recursive: boolean;
  fileGlob: string;
}

interface AutomationCreateWatchFormProps {
  workflows: WorkflowMetadata[];
  enabled: boolean;
  onCreateWatch: (values: CreateWatchValues) => Promise<void>;
}

const DEFAULT_GLOB = "*.*";

export function AutomationCreateWatchForm({
  workflows,
  enabled,
  onCreateWatch,
}: AutomationCreateWatchFormProps) {
  const [workflowId, setWorkflowId] = useState("");
  const [watchPath, setWatchPath] = useState("");
  const [fileGlob, setFileGlob] = useState(DEFAULT_GLOB);
  const [recursive, setRecursive] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setWatchPath(selected);
    }
  };

  const handleCreate = async () => {
    if (!enabled || !workflowId || !watchPath.trim() || saving) {
      return;
    }
    setSaving(true);
    try {
      await onCreateWatch({
        workflowId,
        watchPath: watchPath.trim(),
        recursive,
        fileGlob: fileGlob.trim() || DEFAULT_GLOB,
      });
      setWatchPath("");
      setFileGlob(DEFAULT_GLOB);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Create Watch
      </p>

      <select
        value={workflowId}
        onChange={(event) => setWorkflowId(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">Select workflow</option>
        {workflows.map((workflow) => (
          <option key={workflow.id} value={workflow.id}>
            {workflow.name}
          </option>
        ))}
      </select>

      <div className="flex gap-1.5">
        <input
          value={watchPath}
          onChange={(event) => setWatchPath(event.target.value)}
          placeholder="Folder path..."
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleBrowse}
          className="rounded-md border border-input bg-background px-2 text-muted-foreground transition-colors hover:bg-accent/40"
          title="Pick folder"
        >
          <FolderOpen size={12} />
        </button>
      </div>

      <div className="flex gap-1.5">
        <input
          value={fileGlob}
          onChange={(event) => setFileGlob(event.target.value)}
          placeholder="*.pdf"
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <label className="flex items-center gap-1 rounded-md border border-input bg-background px-2 text-[11px] text-foreground">
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
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        Create Watch
      </button>
    </section>
  );
}
