import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { getProfileOverview } from "@/lib/repositories/profile";
import { timeZoneOptions, formatZone, describeZone } from "@/lib/timezones";
import Stepper from "@/components/profile/Stepper";
import Segmented from "@/components/profile/Segmented";
import Section from "@/components/profile/Section";
import Areas from "@/components/profile/Areas";
import Tags from "@/components/profile/Tags";
import Toggle from "@/components/profile/Toggle";
import DataPanel from "@/components/profile/DataPanel";
import { listTags, staleTags, areaStats } from "@/lib/repositories/tags";
import { weekDays } from "@/lib/week";
import { dayKeyFor, dayKeyToDate } from "@/lib/day";
import { getContentCounts } from "@/lib/repositories/profile";
import { ACCENTS, DENSITIES } from "@/lib/appearance";
import PointsTable from "@/components/profile/PointsTable";
import SectionNav, {
  isSectionKey,
  type SectionKey,
} from "@/components/profile/SectionNav";
import { listAreasWithCounts } from "@/lib/repositories/areas";
import Row, { inputClass } from "@/components/profile/Row";
import SaveForm from "@/components/profile/SaveForm";
import DangerZone from "@/components/profile/DangerZone";
import ThemePicker from "@/components/profile/ThemePicker";
import {
  signOutEverywhere,
  saveProfileTab,
  saveRhythm,
  saveAppearance,
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


export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const section: SectionKey = isSectionKey(params.s) ? params.s : "profile";
  const [p, areas, stats, tags, stale, counts] = await Promise.all([
    getProfileOverview(user.id),
    listAreasWithCounts(user.id),
    areaStats(user.id, dayKeyToDate(weekDays(dayKeyFor(new Date(), "UTC", 0))[0])),
    listTags(user.id),
    staleTags(user.id),
    getContentCounts(user.id),
  ]);
  const staleIds = new Set(stale.map((t) => t.id));

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
              title="Rhythm"
              description="When the app expects you, and when it leaves you alone."
            >
              <p className="mb-4 label-xs tabular">
                {p.streakDays}-day streak
                {p.streakDays > 0 ? " · keep it by clearing the floor" : ""}
              </p>

              <SaveForm action={saveRhythm}>
                <Row
                  label="Daily minimum"
                  help="How many things you need to finish for the day to count."
                >
                  <Stepper
                    name="dailyFloor"
                    defaultValue={p.dailyFloor}
                    min={1}
                    max={20}
                  />
                </Row>

                <Row
                  label="Days off"
                  help="Picked days never break your streak."
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
                  label="Morning planning reminder"
                  htmlFor="morningReminder"
                  hint="A nudge to plan the day before it plans itself. Leave empty for none."
                >
                  <input
                    id="morningReminder"
                    name="morningReminder"
                    type="time"
                    defaultValue={p.morningReminder ?? ""}
                    className={`max-w-[140px] ${inputClass}`}
                  />
                </Row>

                <Row
                  label="Evening check-in reminder"
                  htmlFor="eveningReminder"
                  hint="A prompt to log anything you did but didn't tick off."
                >
                  <input
                    id="eveningReminder"
                    name="eveningReminder"
                    type="time"
                    defaultValue={p.eveningReminder ?? ""}
                    className={`max-w-[140px] ${inputClass}`}
                  />
                </Row>

                <Row
                  label="How far back you can log"
                  help="Without a limit you could log a whole month on the 31st, and your streak would stop meaning anything. Older entries still save — they just count for half."
                  hint="Anything older than this still saves, but counts for half."
                >
                  <Stepper
                    name="backdateLimitDays"
                    defaultValue={p.backdateLimitDays}
                    min={0}
                    max={30}
                    format="days"
                  />
                </Row>

                <Row
                  label="Move unfinished tasks to tomorrow"
                  hint="Anything you don't finish moves forward instead of disappearing."
                >
                  <Toggle
                    name="rolloverUnfinished"
                    defaultChecked={p.rolloverUnfinished}
                    label="Move unfinished tasks to tomorrow"
                  />
                </Row>

                <Row
                  label="Catch up on missed routines"
                  help="Off means a routine you missed is simply skipped, not stacked up."
                >
                  <Toggle
                    name="catchUpRoutines"
                    defaultChecked={p.catchUpRoutines}
                    label="Catch up on missed routines"
                  />
                </Row>
              </SaveForm>
            </Section>
          )}
          {section === "areas" && (
            <>
              <Section
                title="Areas"
                description="The few big buckets your effort splits between. Deleting one never deletes its tasks; they just become unfiled."
              >
                <Areas
                  areas={areas.map((a) => {
                    const stat = stats.find((s) => s.id === a.id);
                    return {
                      id: a.id,
                      name: a.name,
                      colour: a.colour,
                      items: stat?.items ?? 0,
                      minutesThisWeek: stat?.minutesThisWeek ?? 0,
                      totalTasks: a.totalTasks,
                    };
                  })}
                />
              </Section>

              <Section
                title="Tags"
                description="Free-form and cross-cutting. A tag means the same thing on a task, a note, an event or a saved link."
              >
                <Tags
                  tags={tags.map((t) => ({
                    id: t.id,
                    name: t.name,
                    stale: staleIds.has(t.id),
                  }))}
                  areas={areas.map((a) => ({ id: a.id, name: a.name }))}
                  defaultAreaId={p.defaultAreaId}
                  staleCount={stale.length}
                />
              </Section>
            </>
          )}
          {section === "appearance" && (
            <Section
              title="Appearance"
              description="Deliberately small. The accent is one hue with one job."
            >
              <Row label="Theme" hint="System follows your OS setting.">
                <ThemePicker />
              </Row>

              <div className="mt-4 border-t border-ln pt-4">
                <SaveForm action={saveAppearance}>
                  <Row
                    label="Accent"
                    hint="Used only for the active state, progress and scheduled blocks."
                  >
                    <div className="flex gap-1.5">
                      {ACCENTS.map((a) => (
                        <label
                          key={a.value}
                          title={a.label}
                          className="cursor-pointer rounded-md border border-transparent p-0.5 has-[:checked]:border-ink"
                        >
                          <input
                            type="radio"
                            name="accent"
                            value={a.value}
                            defaultChecked={p.accent === a.value}
                            className="sr-only"
                          />
                          <span
                            aria-label={a.label}
                            className={`block size-[20px] rounded ${a.dot}`}
                          />
                        </label>
                      ))}
                    </div>
                  </Row>

                  <Row
                    label="Density"
                    hint="Compact tightens row height across every list."
                  >
                    <Segmented
                      name="density"
                      value={p.density}
                      options={DENSITIES.map((d) => ({
                        value: d,
                        label: d === "comfortable" ? "Comfortable" : "Compact",
                      }))}
                    />
                  </Row>

                  <Row
                    label="Reduce motion"
                    hint="Disables transitions and the board's drag inertia."
                  >
                    <Toggle
                      name="reduceMotion"
                      defaultChecked={p.reduceMotion}
                      label="Reduce motion"
                    />
                  </Row>

                  <Row
                    label="Show points on tasks"
                    help="Off keeps scores off task rows — they stay on the Today page only. This is the same setting as the Scoring tab's visibility, phrased for this page."
                  >
                    <Toggle
                      name="showPointsOnTasks"
                      defaultChecked={p.scoringVisibility === "everywhere"}
                      label="Show points on tasks"
                    />
                  </Row>
                </SaveForm>
              </div>
            </Section>
          )}
          {section === "data" && (
            <>
              <Section title="Your data">
                <DataPanel
                  counts={counts}
                  memberSince={memberSince}
                />
              </Section>

              <Section
                title="Delete my account"
                description="Removes your account and everything in it, permanently."
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
