import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { getProfileOverview } from "@/lib/repositories/profile";
import { zoneGroups } from "@/lib/timezones";
import Stepper from "@/components/profile/Stepper";
import TimeSelect from "@/components/profile/TimeSelect";
import Segmented from "@/components/profile/Segmented";
import Section from "@/components/profile/Section";
import AreasAndTags from "@/components/profile/AreasAndTags";
import AvatarField from "@/components/profile/AvatarField";
import Toggle from "@/components/profile/Toggle";
import DataPanel from "@/components/profile/DataPanel";
import { listTags, staleTags, areaStats } from "@/lib/repositories/tags";
import { weekDays } from "@/lib/week";
import { dayKeyFor, dayKeyToDate } from "@/lib/day";
import { getContentCounts } from "@/lib/repositories/profile";
import { ACCENTS, DENSITIES } from "@/lib/appearance";
import TintPicker from "@/components/profile/TintPicker";
import PointsTable from "@/components/profile/PointsTable";
import SectionNav, {
  isSectionKey,
  type SectionKey,
} from "@/components/profile/SectionNav";
import { listAreasWithCounts } from "@/lib/repositories/areas";
import { inputClass } from "@/components/profile/Row";
import SettingRow from "@/components/profile/SettingRow";
import TimeZoneField from "@/components/profile/TimeZoneField";
import ChangePasswordRow from "@/components/profile/ChangePasswordRow";
import SaveForm from "@/components/profile/SaveForm";
import DangerZone from "@/components/profile/DangerZone";
import ThemePicker from "@/components/profile/ThemePicker";
import {
  signOutEverywhere,
  saveProfileTab,
  saveRhythm,
  saveAppearance,
  saveScoring,
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
    areaStats(
      user.id,
      dayKeyToDate(weekDays(dayKeyFor(new Date(), "UTC", 0))[0]),
    ),
    listTags(user.id),
    staleTags(user.id),
    getContentCounts(user.id),
  ]);
  const staleIds = new Set(stale.map((t) => t.id));

  const zones = zoneGroups(p.timezone);
  const memberSince = p.memberSince.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-6">
      <div className="grid gap-5 md:grid-cols-[152px_1fr]">
        <SectionNav active={section} />

        <div className="flex min-w-0 flex-col gap-4">
          {section === "profile" && (
            <Section title="Profile">
              <AvatarField
                userId={p.userId}
                name={p.name}
                email={p.email}
                version={p.avatarAt ? p.avatarAt.getTime() : null}
              />

              <SaveForm action={saveProfileTab} layout="rows">
                <SettingRow
                  label="Display name"
                  description="Shown in the greeting on Today."
                  htmlFor="name"
                >
                  <input
                    id="name"
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={p.name}
                    autoComplete="name"
                    className={`w-[220px] ${inputClass}`}
                  />
                </SettingRow>

                <SettingRow
                  label="Time zone"
                  description="All your dates and times use this."
                  htmlFor="timezone"
                >
                  <TimeZoneField groups={zones} current={p.timezone} />
                </SettingRow>

                <SettingRow
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
                </SettingRow>

                <SettingRow label="Week starts on">
                  <Segmented
                    name="weekStartsOn"
                    value={String(p.weekStartsOn)}
                    options={[
                      { value: "1", label: "Monday" },
                      { value: "0", label: "Sunday" },
                    ]}
                  />
                </SettingRow>

                <SettingRow label="Time format">
                  <Segmented
                    name="timeFormat"
                    value={p.timeFormat}
                    options={[
                      { value: "24", label: "24-hour" },
                      { value: "12", label: "12-hour" },
                    ]}
                  />
                </SettingRow>
              </SaveForm>

              {/* Password and devices are rows of this panel, as drawn —
                  each its own action, so neither rides along with a
                  "save profile" the user meant for their name. */}
              <div className="mt-5">
                <ChangePasswordRow
                  lastChanged={
                    p.passwordChangedAt
                      ? `Last changed ${relativeSince(p.passwordChangedAt)}.`
                      : "Never changed since you signed up."
                  }
                />

                {/* Its own group. Sitting flush under the password row,
                    an identical outline button reads as a second thing
                    you can do to your password — and it isn't: it ends
                    every session, including the one reading this. */}
                <div className="mt-5 border-t border-ln pt-1">
                  <SettingRow
                    label="Signed-in devices"
                    description={
                      p.otherSessions === 0
                        ? "This is the only device signed in."
                        : `You're signed in on ${p.otherSessions + 1} devices.`
                    }
                  >
                    <form action={signOutEverywhere}>
                      <button
                        type="submit"
                        className="cursor-pointer rounded-[9px] border border-bad bg-surf px-[13px] py-[7px] text-[12.5px] font-semibold text-bad transition-colors hover:bg-bad-soft"
                      >
                        Sign out everywhere
                      </button>
                    </form>
                  </SettingRow>
                </div>
              </div>
            </Section>
          )}
          {section === "scoring" && (
            <Section
              title="Scoring"
              meta="tuned so the score never becomes the goal"
            >
              <SaveForm action={saveScoring} layout="rows">
                <SettingRow
                  label="How much scoring you see"
                  description="Hidden removes points and levels from the whole app except this page."
                  help="Nothing stops being tracked either way — the score is still kept, you just stop being shown it. Everywhere puts points on every task row as well."
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
                </SettingRow>

                <SettingRow
                  label="Daily minimum"
                  description="How many things count as showing up. Also on the Rhythm page."
                >
                  <Stepper
                    name="dailyFloor"
                    defaultValue={p.dailyFloor}
                    min={1}
                    max={20}
                  />
                </SettingRow>

                <SettingRow
                  label="A day's work"
                  description="Points that add up to a full day. Pace is measured against this. Also on the Rhythm page."
                >
                  <Stepper
                    name="dailyTargetPoints"
                    defaultValue={p.dailyTargetPoints}
                    min={1}
                    max={500}
                    step={5}
                  />
                </SettingRow>

                <SettingRow
                  label="Daily point limit"
                  description="After this many points in a day, extra work counts for less. Nothing is ever blocked."
                  help="Past the limit an award pays half, then a quarter. It exists so a long day doesn't turn into chasing the number."
                >
                  <Stepper
                    name="dailyCap"
                    defaultValue={p.dailyCap}
                    min={20}
                    max={1000}
                    step={10}
                  />
                </SettingRow>
              </SaveForm>

              <div className="mt-5 border-t border-ln pt-4">
                <PointsTable />
              </div>
            </Section>
          )}
          {section === "rhythm" && (
            <Section title="Rhythm">
              {/* Only worth saying once there is a streak to describe.
                  "0-day streak" is a fact nobody needs. */}
              {p.streakDays > 0 && (
                <p className="label-xs tabular mb-1">
                  {p.streakDays}-day streak
                </p>
              )}

              <SaveForm action={saveRhythm} layout="rows">
                <SettingRow
                  label="Daily minimum"
                  description="How many things you need to finish to keep the streak. At one, showing up at all is enough."
                  help="The streak asks whether you turned up, not how much you did. Raise this only if one small thing genuinely shouldn't count."
                >
                  <Stepper
                    name="dailyFloor"
                    defaultValue={p.dailyFloor}
                    min={1}
                    max={20}
                  />
                </SettingRow>

                <SettingRow
                  label="A day's work"
                  description="Points that add up to a full day. Pace is measured against this."
                  help="Separate from the daily minimum on purpose: the minimum decides whether the streak holds, this decides what counts as a full day of effort."
                >
                  <Stepper
                    name="dailyTargetPoints"
                    defaultValue={p.dailyTargetPoints}
                    min={1}
                    max={500}
                    step={5}
                  />
                </SettingRow>

                <SettingRow
                  label="Days off"
                  description="Picked days never break your streak."
                >
                  <div className="flex flex-wrap justify-end gap-1.5">
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
                </SettingRow>

                <SettingRow
                  label="Morning planning reminder"
                  description="A nudge to plan the day before it plans itself."
                  help="Shown the next time you open Krama after this time — Krama has no way to push a notification, so it waits for you."
                  htmlFor="morningReminder"
                >
                  <TimeSelect
                    id="morningReminder"
                    name="morningReminder"
                    value={p.morningReminder}
                  />
                </SettingRow>

                <SettingRow
                  label="Evening check-in reminder"
                  description="A prompt to log anything you did but didn't tick off."
                  htmlFor="eveningReminder"
                >
                  <TimeSelect
                    id="eveningReminder"
                    name="eveningReminder"
                    value={p.eveningReminder}
                  />
                </SettingRow>

                <SettingRow
                  label="How far back you can log"
                  description="Anything older than this still saves, but counts for half."
                  help="Without a limit you could log a whole month on the 31st, and your streak would stop meaning anything."
                >
                  <Stepper
                    name="backdateLimitDays"
                    defaultValue={p.backdateLimitDays}
                    min={0}
                    max={30}
                    format="days"
                  />
                </SettingRow>

                <SettingRow
                  label="Move unfinished tasks to tomorrow"
                  description="Anything you don't finish moves forward instead of disappearing."
                >
                  <Toggle
                    name="rolloverUnfinished"
                    defaultChecked={p.rolloverUnfinished}
                    label="Move unfinished tasks to tomorrow"
                  />
                </SettingRow>

                <SettingRow
                  label="Catch up on missed routines"
                  description="Off means a routine you missed is simply skipped, not stacked up."
                  help="On, Krama fills in the last week of missed routine instances when you next open it."
                >
                  <Toggle
                    name="catchUpRoutines"
                    defaultChecked={p.catchUpRoutines}
                    label="Catch up on missed routines"
                  />
                </SettingRow>
              </SaveForm>
            </Section>
          )}
          {section === "areas" && (
            <Section title="Areas & tags">
              <AreasAndTags
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
                tags={tags.map((t) => ({
                  id: t.id,
                  name: t.name,
                  colour: t.colour,
                  stale: staleIds.has(t.id),
                }))}
                defaultAreaId={p.defaultAreaId}
                staleCount={stale.length}
              />
            </Section>
          )}
          {section === "appearance" && (
            <Section title="Appearance">
              <SettingRow
                label="Theme"
                description="System follows your OS setting."
              >
                <ThemePicker />
              </SettingRow>

              <SaveForm action={saveAppearance} layout="rows">
                <SettingRow
                  label="Accent"
                  description="Used only for the active state, progress and scheduled blocks."
                >
                  <div className="flex gap-2">
                    {ACCENTS.map((a) => (
                      <label
                        key={a.value}
                        title={a.label}
                        className="cursor-pointer rounded-[7px] p-0.5 ring-ink has-[:checked]:ring-2"
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
                          className={`block size-[22px] rounded-[5px] ${a.dot}`}
                        />
                      </label>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow
                  label="Note colours"
                  description="The five sticky tints. Click one to recolour it."
                >
                  <TintPicker chosen={p.noteTints} />
                </SettingRow>

                <SettingRow
                  label="Density"
                  description="Compact tightens row height across every list."
                >
                  <Segmented
                    name="density"
                    value={p.density}
                    options={DENSITIES.map((d) => ({
                      value: d,
                      label: d === "comfortable" ? "Comfortable" : "Compact",
                    }))}
                  />
                </SettingRow>

                <SettingRow label="Interface font">
                  <Segmented
                    name="interfaceFont"
                    value={p.interfaceFont}
                    options={[
                      { value: "krama", label: "Cal Sans + Inter" },
                      { value: "system", label: "System" },
                    ]}
                  />
                </SettingRow>

                <SettingRow
                  label="Reduce motion"
                  description="Follows your OS setting by default. Disables transitions and the board's drag inertia."
                >
                  <Toggle
                    name="reduceMotion"
                    defaultChecked={p.reduceMotion}
                    label="Reduce motion"
                  />
                </SettingRow>

                <SettingRow
                  label="Show points on tasks"
                  description="Off keeps scores off task rows — they stay on the Today page only."
                >
                  <Toggle
                    name="showPointsOnTasks"
                    defaultChecked={p.scoringVisibility === "everywhere"}
                    label="Show points on tasks"
                  />
                </SettingRow>
              </SaveForm>
            </Section>
          )}
          {section === "data" && (
            <>
              <Section title="What you've done">
                <DataPanel counts={counts} memberSince={memberSince} />
              </Section>

              <Section
                title="Delete my account"
                description="Removes your account and everything in it, permanently."
                danger
              >
                <DangerZone
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
