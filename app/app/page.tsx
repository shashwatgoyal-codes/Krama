import { requireUser } from "@/lib/auth/guard";
import { getSettings, getTodayStats } from "@/lib/repositories/profile";
import { listOpenTasks, listTasksForDay } from "@/lib/repositories/tasks";
import { dayKeyFor } from "@/lib/day";
import { materialiseRecurring } from "@/lib/repositories/recurring";
import { formatDay } from "@/lib/format";
import Today from "@/components/Today";

export default async function TodayPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const dayKey = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);

  // Routines appear on their own — that's the whole point of them. Done
  // on load rather than by a scheduled job so it works without any
  // background infrastructure, and it's idempotent, so opening two tabs
  // doesn't produce two standups.
  await materialiseRecurring(user.id, dayKey);

  const [stats, todays, open] = await Promise.all([
    getTodayStats(user.id),
    listTasksForDay(user.id, dayKey),
    listOpenTasks(user.id),
  ]);

  // Today's list is what was filed for today; the right pane is anything
  // still open that isn't already on it.
  const todayIds = new Set(todays.map((t) => t.id));
  const unscheduled = open.filter((t) => !todayIds.has(t.id));

  return (
    <Today
      name={user.name}
      day={formatDay(new Date())}
      today={todays.map((t) => ({
        id: t.id,
        title: t.title,
        points: t.points,
        done: t.status === "done",
        recurring: t.recurrence !== "none",
      }))}
      unscheduled={unscheduled.map((t) => ({
        id: t.id,
        title: t.title,
        points: t.points,
        done: false,
        recurring: t.recurrence !== "none",
      }))}
      stats={stats}
      showScoring={settings.scoringVisibility !== "hidden"}
    />
  );
}
