import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { getProfileOverview } from "@/lib/repositories/profile";
import { timeZoneOptions, formatZone, describeZone } from "@/lib/timezones";
import Stepper from "@/components/profile/Stepper";
import Segmented from "@/components/profile/Segmented";
import Section from "@/components/profile/Section";
import Areas from "@/components/profile/Areas";
import PointsTable from "@/components/profile/PointsTable";
import SectionNav, {
  isSectionKey,
  type SectionKey,
} from "@/components/profile/SectionNav";
import { listAreasWithCounts } from "@/lib/repositories/areas";
import Row, { inputClass } from "@/components/profile/Row";
import SaveForm from "@/components/profile/SaveForm";
import DangerZone from "@/components/profile/DangerZone";
import ThemeToggle from "@/components/ThemeToggle";
import {
  signOutEverywhere,
  saveProfileTab,
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


/** "3 months ago", "yesterday" — enough to judge, no false precision. */
function relativeSince(at: Date): string {
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function hourLabel(h: number): string {
  if (h === 0) return "Midnight";
  if (h === 12) return "Noon";
  return `${h}:00 am`;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const section: SectionKey = isSectionKey(params.s) ? params.s : "profile";
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

      <div className="grid gap-5 md:grid-cols-[152px_1fr]">
        <SectionNav active={section} />

        <div className="flex min-w-0 flex-col gap-4">
          {section === "profile" && (
            <>
              <Section
                title="Profile"
                description="Who you are, and the time settings everything else depends on."
              >
                <SaveForm action={saveProfileTab}>
                  <Row
                    label="Display name"
                    htmlFor="name"
                    hint="Shown in the greeting on Today."
                  >
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
                    label="Time zone"
                    htmlFor="timezone"
                    hint={`All your dates and times use this. Currently ${describeZone(p.timezone)}.`}
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
                    label="When your day ends"
                    help="Anything you finish before this time still counts as yesterday. Set it to when you actually go to sleep."
                  >
                    <Stepper
                      name="dayEndsAtHour"
                      defaultValue={p.dayEndsAtHour}
                      min={0}
                      max={12}
                      format="hour"
                    />
                  </Row>

                  <Row label="Week starts on">
                    <Segmented
                      name="weekStartsOn"
                      value={String(p.weekStartsOn)}
                      options={[
                        { value: "1", label: "Monday" },
                        { value: "0", label: "Sunday" },
                      ]}
                    />
                  </Row>

                  <Row label="Time format">
                    <Segmented
                      name="timeFormat"
                      value={p.timeFormat}
                      options={[
                        { value: "24", label: "24-hour" },
                        { value: "12", label: "12-hour" },
                      ]}
                    />
                  </Row>
                </SaveForm>
              </Section>

              <Section title="Password">
                <p className="mb-3 text-[12px] text-mut">
                  {p.passwordChangedAt
                    ? `Last changed ${relativeSince(p.passwordChangedAt)}.`
                    : "Never changed since you signed up."}
                </p>
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
                    hint="At least 10 characters. Length matters more than symbols."
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

              <Section title="Signed-in devices">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-[46ch] text-[12px] leading-relaxed text-mut">
                    {p.otherSessions === 0
                      ? "This is the only device signed in."
                      : `You're signed in on ${p.otherSessions + 1} devices.`}
                  </p>
                  <form action={signOutEverywhere}>
                    <button
                      type="submit"
                      className="cursor-pointer rounded-[9px] border border-ln2 bg-surf px-[13px] py-[7px] text-[12.5px] font-semibold text-ink2 transition-colors hover:border-acc hover:text-acc"
                    >
                      Sign out everywhere
                    </button>
                  </form>
                </div>
              </Section>
            </>
          )}
          {section === "scoring" && (
            <Section
              title="Scoring"
              description="Tuned so the score never becomes the goal."
            >
              <SaveForm action={saveScoring}>
                <Row
                  label="How much scoring you see"
                  help="Hidden removes points and levels from the whole app except this page."
                >
                  <Segmented
                    name="scoringVisibility"
                    value={p.scoringVisibility}
                    options={[
                      { value: "hidden", label: "Hidden" },
                      { value: "normal", label: "Normal" },
                      { value: "everywhere", label: "Everywhere" },
                    ]}
                  />
                </Row>

                <Row
                  label="Daily minimum"
                  hint="How many things count as showing up. Also on the Rhythm page."
                >
                  <Stepper
                    name="dailyFloor"
                    defaultValue={p.dailyFloor}
                    min={1}
                    max={20}
                  />
                </Row>

                <Row
                  label="Daily point limit"
                  help="After this many points in a day, extra work counts for less. Nothing is ever blocked."
                >
                  <Stepper
                    name="dailyCap"
                    defaultValue={p.dailyCap}
                    min={20}
                    max={1000}
                    step={10}
                  />
                </Row>
              </SaveForm>

              <div className="mt-5 border-t border-ln pt-4">
                <PointsTable />
              </div>
            </Section>
          )}
          {section === "rhythm" && (
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
              </SaveForm>
            </Section>
          )}
          {section === "areas" && (
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
          )}
          {section === "appearance" && (
            <Section title="Appearance">
              <div className="flex items-center justify-between gap-3">
                <div className="max-w-[46ch]">
                  <p className="text-[12px] font-semibold text-ink">Theme</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-mut">
                    Follows your system by default. Switching here overrides it
                    and is remembered on this device.
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </Section>
          )}
          {section === "data" && (
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
          )}
        </div>
      </div>
    </div>
  );
}
