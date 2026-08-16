import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { getProfileOverview } from "@/lib/repositories/profile";
import { POINTS } from "@/lib/points";
import { timeZoneOptions, formatZone } from "@/lib/timezones";
import Section from "@/components/profile/Section";
import Areas from "@/components/profile/Areas";
import { listAreasWithCounts } from "@/lib/repositories/areas";
import Row, { inputClass } from "@/components/profile/Row";
import SaveForm from "@/components/profile/SaveForm";
import DangerZone from "@/components/profile/DangerZone";
import ThemeToggle from "@/components/ThemeToggle";
import {
  saveName,
  saveDaySchedule,
  saveScoring,
  changePassword,
} from "./actions";

export const metadata: Metadata = {
  title: "Profile · Krama",
  robots: { index: false, follow: false },
};

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const VISIBILITY = [
  {
    value: "hidden",
    label: "Hidden",
    blurb:
      "No points, levels or streaks anywhere. Krama becomes a plain planner.",
  },
  {
    value: "normal",
    label: "Normal",
    blurb: "Your score is on the Today page. Everything else stays quiet.",
  },
  {
    value: "everywhere",
    label: "Everywhere",
    blurb: "Points shown beside every task, all the time.",
  },
];

function hourLabel(h: number): string {
  if (h === 0) return "Midnight";
  if (h === 12) return "Noon";
  return `${h}:00 am`;
}

export default async function ProfilePage() {
  const user = await requireUser();
  const [p, areas] = await Promise.all([
    getProfileOverview(user.id),
    listAreasWithCounts(user.id),
  ]);

  const zones = timeZoneOptions(p.timezone);
  const memberSince = p.memberSince.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 py-6">
      <div className="mb-1 flex items-center gap-3">
        <span className="grid size-9 flex-none place-items-center rounded-full bg-acc text-[14px] font-bold text-on-acc">
          {p.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold tracking-[-0.025em]">
            {p.name}
          </h1>
          <p className="truncate text-[12px] text-mut">{p.email}</p>
        </div>
      </div>
      <p className="mb-5 text-[11.5px] text-fai">
        With Krama since {memberSince}
      </p>

      {/* A read-only summary first: what the settings below are shaping. */}
      {p.scoringVisibility !== "hidden" && (
        <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ln bg-ln sm:grid-cols-4">
          {[
            { label: "Level", value: p.level },
            { label: "Points", value: p.totalPoints },
            { label: "Streak", value: `${p.streakDays}d` },
            { label: "Tasks done", value: p.tasksDone },
          ].map((s) => (
            <div key={s.label} className="bg-surf px-3 py-3">
              <p className="label-xs">{s.label}</p>
              <p className="tabular mt-1 font-display text-[19px] font-semibold">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Section
          title="Your name"
          description="Only used to greet you. Nobody else sees it."
        >
          <SaveForm action={saveName}>
            <Row label="Name" htmlFor="name">
              <input
                id="name"
                name="name"
                required
                maxLength={80}
                defaultValue={p.name}
                autoComplete="name"
                className={`max-w-[320px] ${inputClass}`}
              />
            </Row>
            <Row
              label="Email"
              help="Changing your email isn't built yet — it needs a confirmation step so a typo can't lock you out of your own account."
            >
              <input
                value={p.email}
                readOnly
                disabled
                aria-label="Email"
                className={`max-w-[320px] cursor-not-allowed ${inputClass}`}
              />
            </Row>
          </SaveForm>
        </Section>

        <Section
          title="When your day starts and ends"
          description="Krama has to decide which day a finished task belongs to. These two settings are how it decides."
        >
          <SaveForm action={saveDaySchedule}>
            <Row
              label="Time zone"
              htmlFor="timezone"
              help="Everything is filed against your local date. If this is wrong, tasks will land on the wrong day."
            >
              <select
                id="timezone"
                name="timezone"
                defaultValue={p.timezone}
                className={`max-w-[320px] ${inputClass}`}
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {formatZone(z)}
                  </option>
                ))}
              </select>
            </Row>

            <Row
              label="My day ends at"
              htmlFor="dayEndsAtHour"
              help="If you finish something at 1am, you almost certainly think of it as part of last night — not as the first thing you did today. Anything completed before this hour counts toward the previous day, so a late night doesn't break a streak or start a new day early."
            >
              <select
                id="dayEndsAtHour"
                name="dayEndsAtHour"
                defaultValue={p.dayEndsAtHour}
                className={`max-w-[200px] ${inputClass}`}
              >
                {Array.from({ length: 13 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </Row>
          </SaveForm>
        </Section>

        <Section
          title="Points and pace"
          description="Krama scores effort, not outcomes — the most any single action can pay is 30 points, the least is 5. These settings decide how much of that you see."
        >
          <SaveForm action={saveScoring}>
            <Row
              label="A good day is"
              htmlFor="dailyFloor"
              help="The number of things that counts as showing up. Keep it low enough to clear on a bad day — that's the point of it. Clearing the floor is what holds a streak together."
            >
              <div className="flex items-center gap-2">
                <input
                  id="dailyFloor"
                  name="dailyFloor"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={p.dailyFloor}
                  className={`max-w-[90px] ${inputClass}`}
                />
                <span className="text-[12px] text-mut">
                  things finished, most days
                </span>
              </div>
            </Row>

            <Row
              label="Ease off after"
              htmlFor="dailyCap"
              help={`Past this many points in a day, awards pay half, then a quarter. Nothing is ever blocked — this exists so a long day doesn't turn into chasing the number. For scale, the biggest single action pays ${POINTS.deepBlock}.`}
            >
              <div className="flex items-center gap-2">
                <input
                  id="dailyCap"
                  name="dailyCap"
                  type="number"
                  min={20}
                  max={1000}
                  step={10}
                  defaultValue={p.dailyCap}
                  className={`max-w-[90px] ${inputClass}`}
                />
                <span className="text-[12px] text-mut">points in a day</span>
              </div>
            </Row>

            <Row
              label="Days off"
              help="Days that never count against you. A streak survives them untouched, so a deliberate rest doesn't read as a failure."
            >
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <label
                    key={d.value}
                    className="cursor-pointer select-none rounded-md border border-ln2 px-2.5 py-1.5 text-[11.5px] font-semibold text-mut transition-colors has-[:checked]:border-acc has-[:checked]:bg-acc-soft has-[:checked]:text-acc"
                  >
                    <input
                      type="checkbox"
                      name="restDays"
                      value={d.value}
                      defaultChecked={p.restDays.includes(d.value)}
                      className="sr-only"
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </Row>

            <Row
              label="How much of the scoring you want to see"
              help="If the points start pulling your attention away from the work, turn them down. Nothing stops being tracked — you just stop being shown it."
            >
              <div className="flex flex-col gap-1.5">
                {VISIBILITY.map((v) => (
                  <label
                    key={v.value}
                    className="flex cursor-pointer gap-2.5 rounded-lg border border-ln2 px-3 py-2 transition-colors has-[:checked]:border-acc has-[:checked]:bg-acc-soft"
                  >
                    <input
                      type="radio"
                      name="scoringVisibility"
                      value={v.value}
                      defaultChecked={p.scoringVisibility === v.value}
                      className="mt-[3px] size-3.5 flex-none accent-[var(--acc)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-ink">
                        {v.label}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-mut">
                        {v.blurb}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Row>
          </SaveForm>
        </Section>

        <Section
          title="Areas"
          description="How work is grouped — on the Tasks list, in the detail panel, and on each block in the plan. Deleting one never deletes its tasks; they just become unfiled."
        >
          <Areas
            areas={areas.map((a) => ({
              id: a.id,
              name: a.name,
              colour: a.colour,
              openTasks: a.openTasks,
              totalTasks: a.totalTasks,
            }))}
          />
        </Section>

        <Section title="Appearance">
          <div className="flex items-center justify-between gap-3">
            <div className="max-w-[46ch]">
              <p className="text-[12px] font-semibold text-ink">Theme</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-mut">
                Follows your system by default. Switching here overrides it and
                is remembered on this device.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </Section>

        <Section
          title="Change password"
          description="Changing it signs out every other device — which is the point, if one of them isn't yours any more."
        >
          <SaveForm action={changePassword} label="Change password">
            <Row label="Current password" htmlFor="currentPassword">
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className={`max-w-[320px] ${inputClass}`}
              />
            </Row>
            <Row
              label="New password"
              htmlFor="newPassword"
              hint="At least 10 characters. Length matters more than symbols — a short phrase you'll remember beats a scramble you won't."
            >
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={`max-w-[320px] ${inputClass}`}
              />
            </Row>
          </SaveForm>
        </Section>

        <Section
          title="Danger zone"
          description="Everything here is immediate and cannot be undone."
          danger
        >
          <DangerZone
            otherSessions={p.otherSessions}
            counts={{
              tasksDone: p.tasksDone,
              notesKept: p.notesKept,
              totalPoints: p.totalPoints,
            }}
          />
        </Section>
      </div>
    </div>
  );
}
