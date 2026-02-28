import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useAutomationStore } from "@/stores/automationStore";
import type { WatchStatus } from "@/types/automation";
import type { AutomationWatch } from "@/types/automation";
import { trackEvent } from "@/lib/analytics";
import { AutomationSchedulePanel } from "@/components/layout/AutomationSchedulePanel";
import { AutomationAlertsSection } from "@/components/layout/AutomationAlertsSection";
import { AutomationHealthSection } from "@/components/layout/AutomationHealthSection";
import { AutomationCreateWatchForm } from "@/components/layout/AutomationCreateWatchForm";
import { AutomationWatchList } from "@/components/layout/AutomationWatchList";
import { AutomationRecentRuns } from "@/components/layout/AutomationRecentRuns";

export function AutomationPanel() {
  const { workflows } = useWorkflowStore();
  const {
    enabled,
    loading,
    fetchAll,
    createWatch,
    toggleWatch,
    deleteWatch,
    runWatchNow,
    getLastFailedRun,
    getSortedWatches,
    getHealthSnapshot,
    getRecentRuns,
    getRecentAlerts,
  } = useAutomationStore();
  const [busyWatchId, setBusyWatchId] = useState<string | null>(null);
  const [failureMessages, setFailureMessages] = useState<
    Record<string, string | null | undefined>
  >({});
  const trackedViewRef = useRef(false);

  useEffect(() => {
    void fetchAll();
    const timer = window.setInterval(() => {
      void fetchAll();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchAll]);

  const sortedWatches = getSortedWatches();
  const healthSnapshot = getHealthSnapshot();
  const recentAlerts = getRecentAlerts(5);
  const recentRuns = getRecentRuns(8);

  useEffect(() => {
    if (trackedViewRef.current || loading) {
      return;
    }
    trackedViewRef.current = true;
    void trackEvent("automation_dashboard_viewed", {
      watches_count: sortedWatches.length,
      active_count: healthSnapshot.active_watches,
      runner_enabled: enabled,
    });
  }, [enabled, healthSnapshot.active_watches, loading, sortedWatches.length]);

  const workflowMap = useMemo(
    () => new Map(workflows.map((workflow) => [workflow.id, workflow.name])),
    [workflows]
  );

  const trackQuickAction = (action: string, watch: AutomationWatch) =>
    trackEvent("automation_quick_action_clicked", {
      action,
      watch_id: watch.id,
      workflow_id: watch.workflow_id,
      status_before: watch.status,
    });

  const handleCreateWatch = async (values: {
    workflowId: string;
    watchPath: string;
    recursive: boolean;
    fileGlob: string;
  }) => {
    try {
      await createWatch({
        workflowId: values.workflowId,
        watchPath: values.watchPath,
        recursive: values.recursive,
        fileGlob: values.fileGlob,
      });
    } catch (error) {
      console.error("failed to create watch", error);
    }
  };

  const nextStatus = (status: WatchStatus): WatchStatus =>
    status === "active" ? "paused" : "active";

  const handleRunNow = async (watch: AutomationWatch) => {
    setBusyWatchId(watch.id);
    try {
      await trackQuickAction("run_now", watch);
      await runWatchNow(watch.id);
    } finally {
      setBusyWatchId(null);
    }
  };

  const handleToggle = async (watch: AutomationWatch) => {
    setBusyWatchId(watch.id);
    try {
      const status = nextStatus(watch.status);
      await trackQuickAction("toggle_status", watch);
      await toggleWatch(watch.id, status);
    } finally {
      setBusyWatchId(null);
    }
  };

  const handleDisable = async (watch: AutomationWatch) => {
    if (watch.status === "disabled") {
      return;
    }
    setBusyWatchId(watch.id);
    try {
      await trackQuickAction("disable_watch", watch);
      await toggleWatch(watch.id, "disabled");
    } finally {
      setBusyWatchId(null);
    }
  };

  const handleDelete = async (watch: AutomationWatch) => {
    setBusyWatchId(watch.id);
    try {
      await trackQuickAction("delete_watch", watch);
      await deleteWatch(watch.id);
      setFailureMessages((current) => {
        const next = { ...current };
        delete next[watch.id];
        return next;
      });
    } finally {
      setBusyWatchId(null);
    }
  };

  const handleOpenLastFailure = async (watch: AutomationWatch) => {
    setBusyWatchId(watch.id);
    try {
      await trackQuickAction("open_last_failure", watch);
      const failedRun = await getLastFailedRun(watch.id);
      setFailureMessages((current) => ({
        ...current,
        [watch.id]: failedRun?.error_message ?? null,
      }));
    } finally {
      setBusyWatchId(null);
    }
  };

  return (
    <div className="space-y-3">
      <AutomationHealthSection enabled={enabled} snapshot={healthSnapshot} />

      <AutomationAlertsSection
        alerts={recentAlerts}
        workflowNameMap={workflowMap}
      />

      <AutomationCreateWatchForm
        workflows={workflows}
        enabled={enabled}
        onCreateWatch={handleCreateWatch}
      />

      <AutomationWatchList
        watches={sortedWatches}
        workflowNameMap={workflowMap}
        enabled={enabled}
        busyWatchId={busyWatchId}
        failureMessages={failureMessages}
        onRunNow={handleRunNow}
        onToggle={handleToggle}
        onDisable={handleDisable}
        onDelete={handleDelete}
        onOpenLastFailure={handleOpenLastFailure}
      />

      <AutomationRecentRuns runs={recentRuns} workflowNameMap={workflowMap} />

      <details className="rounded-lg border border-border bg-muted/20 p-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Schedules
        </summary>
        <div className="mt-2">
          <AutomationSchedulePanel workflowMap={workflowMap} />
        </div>
      </details>
    </div>
  );
}
