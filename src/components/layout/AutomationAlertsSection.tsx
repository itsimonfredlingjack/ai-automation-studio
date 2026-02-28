import type { RuntimeAlert } from "@/types/automation";
import { formatRelativeTime } from "@/lib/time";

interface AutomationAlertsSectionProps {
  alerts: RuntimeAlert[];
  workflowNameMap: Map<string, string>;
}

function formatSourceLabel(source: RuntimeAlert["source"]): string {
  switch (source) {
    case "webhook_bind":
      return "Webhook bind";
    case "webhook_server":
      return "Webhook server";
    case "watch_runner":
      return "Watch runner";
    case "schedule_runner":
      return "Schedule runner";
    case "watch_auto_pause":
      return "Watch auto-pause";
    case "schedule_auto_pause":
      return "Schedule auto-pause";
  }
}

export function AutomationAlertsSection({
  alerts,
  workflowNameMap,
}: AutomationAlertsSectionProps) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Runner Alerts
        </p>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {alerts.length} visible
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          No runtime alerts yet.
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const toneClass =
              alert.severity === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-700"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700";
            const workflowName = alert.workflow_id
              ? workflowNameMap.get(alert.workflow_id)
              : null;

            return (
              <div key={alert.id} className={`rounded-md border px-3 py-2 ${toneClass}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide">
                      {formatSourceLabel(alert.source)}
                    </p>
                    <p className="mt-1 text-sm leading-snug">{alert.message}</p>
                    {workflowName && (
                      <p className="mt-1 text-[11px] text-current/80">
                        Workflow: {workflowName}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-current/80">
                    {formatRelativeTime(alert.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
