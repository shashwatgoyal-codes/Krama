import Today from "@/components/Today";
import { formatDay } from "@/lib/format";

// Placeholder data until the database is wired up. Shape matches the
// Prisma models so swapping the source is a one-line change.
const PLAN = [
  { id: "b1", time: "10:00", minutes: 30, title: "Sprint standup", meta: "Office · recurring, weekdays", state: "done" as const },
  { id: "b2", time: "11:00", minutes: 60, title: "Review the integration PR", meta: "Office · done · +25", state: "done" as const },
  { id: "b3", time: "14:00", minutes: 120, title: "Draft the API migration notes", meta: "Office · deep block", state: "now" as const },
  { id: "b4", time: "20:00", minutes: 45, title: "Study block — distributed systems", meta: "Research", state: "idle" as const },
];

const UNSCHEDULED = [
  { id: "t1", title: "Summarise three papers", points: 30, done: false },
  { id: "t2", title: "Call home", points: 12, done: false },
  { id: "t3", title: "Update the CV summary", points: 20, done: false },
  { id: "t4", title: "Reply to the recruiter note", points: 15, done: false },
];

export default function TodayPage() {
  return (
    <Today
      day={formatDay(new Date())}
      plan={PLAN}
      unscheduled={UNSCHEDULED}
      pace={68}
      streakDays={18}
      committedMinutes={255}
    />
  );
}
