import { useState } from "react";
import { Loader2, Pause, Play, Trash2 } from "lucide-react";
import { useAutomationStore } from "@/stores/automationStore";
import type { ScheduleCadence, ScheduleStatus } from "@/types/automation";
const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
interface AutomationSchedulePanelProps {
  workflowMap: Map<string, string>;
}

export function AutomationSchedulePanel({ workflowMap }: AutomationSchedulePanelProps) {
  const {
    enabled,
    schedules,
    scheduleRuns,
    createSchedule,
    toggleSchedule,
    deleteSchedule,
  } = useAutomationStore();
  const [workflowId, setWorkflowId] = useState("");
  const [cadence, setCadence] = useState<ScheduleCadence>("hourly");
  const [hourlyInterval, setHourlyInterval] = useState(4);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [weeklyDays, setWeeklyDays] = useState<string[]>(["mon"]);
  const [saving, setSaving] = useState(false);
  const flipWeeklyDay = (day: string) => {
    setWeeklyDays((current) =>
      current.includes(day)
        ? current.filter((entry) => entry !== day)
        : [...current, day]
    );
  };

  const handleCreate = async () => {
    if (!workflowId || saving) return;
    if (cadence === "weekly" && weeklyDays.length === 0) return;
    setSaving(true);
    try {
      await createSchedule({
        workflowId,
        cadence,
        hourlyInterval: cadence === "hourly" ? Math.max(1, hourlyInterval) : undefined,
        weeklyDays: cadence === "weekly" ? weeklyDays : undefined,
        hour: cadence === "weekly" ? hour : undefined,
        minute: cadence === "weekly" ? minute : undefined,
      });
      if (cadence === "weekly") {
        setWeeklyDays(["mon"]);
      }
    } finally {
      setSaving(false);
    }
  };

  const nextStatus = (status: ScheduleStatus): ScheduleStatus =>
    status === "active" ? "paused" : "active";
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/20 p-2">
      <p className="text-[11px] font-medium text-foreground">Scheduled automations</p>
      <div className="mt-2 space-y-2">
        <select
          value={workflowId}
          onChange={(event) => setWorkflowId(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          <option value="">Select workflow</option>
          {Array.from(workflowMap.entries()).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <select
            value={cadence}
            onChange={(event) => setCadence(event.target.value as ScheduleCadence)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="hourly">Hourly</option>
            <option value="weekly">Weekly</option>
          </select>
          {cadence === "hourly" ? (
            <input
              type="number"
              min={1}
              max={24}
              value={hourlyInterval}
              onChange={(event) => setHourlyInterval(Number(event.target.value))}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs"
              title="Interval (hours)"
            />
          ) : (
            <div className="flex flex-1 items-center gap-1">
              <input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(event) => setHour(Number(event.target.value))}
                className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
                title="Hour"
              />
              <input
                type="number"
                min={0}
                max={59}
                value={minute}
                onChange={(event) => setMinute(Number(event.target.value))}
                className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
                title="Minute"
              />
            </div>
          )}
        </div>
        {cadence === "weekly" && (
          <div className="grid grid-cols-7 gap-1">
            {WEEK_DAYS.map((day) => (
              <button
                key={day}
                onClick={() => flipWeeklyDay(day)}
                className={`rounded border px-1 py-0.5 text-[10px] uppercase ${
                  weeklyDays.includes(day)
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-input text-muted-foreground"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={handleCreate}
          disabled={!enabled || !workflowId || saving}
          className="flex w-full items-center justify-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Create Schedule
        </button>
      </div>
      <div className="mt-2 space-y-1">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="rounded border border-border bg-background p-2 text-[11px]">
            <p className="truncate font-medium">
              {workflowMap.get(schedule.workflow_id) ?? schedule.workflow_id}
            </p>
            <p className="text-muted-foreground">
              {schedule.cadence === "hourly"
                ? `Every ${schedule.hourly_interval ?? 1}h`
                : `${schedule.weekly_days.join(", ")} @ ${String(schedule.hour).padStart(2, "0")}:${String(
                    schedule.minute
                  ).padStart(2, "0")}`}
            </p>
            <p className="text-muted-foreground">Next: {new Date(schedule.next_run_at).toLocaleString()}</p>
            <div className="mt-1 flex gap-1">
              <button
                onClick={() => void toggleSchedule(schedule.id, nextStatus(schedule.status))}
                disabled={!enabled}
                className="rounded border border-input px-2 py-0.5"
              >
                {schedule.status === "active" ? <Pause size={11} /> : <Play size={11} />}
              </button>
              <button
                onClick={() => void toggleSchedule(schedule.id, "disabled")}
                className="rounded border border-input px-2 py-0.5"
              >
                Disable
              </button>
              <button
                onClick={() => void deleteSchedule(schedule.id)}
                className="rounded border border-destructive/40 px-2 py-0.5 text-destructive"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
        {schedules.length === 0 && (
          <p className="text-center text-[11px] text-muted-foreground">No schedules yet.</p>
        )}
      </div>
      <div className="mt-2 rounded border border-border bg-muted/30 p-2">
        <p className="text-[11px] font-medium text-foreground">Recent scheduled runs</p>
        <div className="mt-1 space-y-1">
          {scheduleRuns.slice(0, 5).map((run) => (
            <p key={run.id} className="truncate text-[11px] text-muted-foreground">
              {run.status} · {run.duration_ms}ms · {run.workflow_id}
            </p>
          ))}
          {scheduleRuns.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No scheduled runs yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
