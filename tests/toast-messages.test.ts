import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A toast must describe the action that was taken.
 *
 * Four panels each routed every one of their forms through a single
 * submitter with a single hardcoded message, so deleting a task said
 * "Task updated.", removing a saved link said "Saved.", and removing a
 * reward said "Done." The toast is the only feedback these actions give;
 * one that names a different action than the one performed is worse than
 * none, because it sends you off to check whether it worked.
 *
 * These read the source rather than render it — there is no DOM harness
 * here — and they guard the shape rather than the wording: a shared
 * submitter must take its message from the caller.
 */

const root = join(import.meta.dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

const SHARED_SUBMITTERS = [
  "components/tasks/TaskDetail.tsx",
  "components/explore/LinkDetail.tsx",
  "components/rewards/RewardList.tsx",
  "components/profile/AreasAndTags.tsx",
];

describe("panels that submit several actions through one helper", () => {
  it.each(SHARED_SUBMITTERS)("%s takes its message from the caller", (file) => {
    const src = read(file);
    // The helper confirms with a parameter, not a string it chose itself.
    expect(src).toMatch(/toast\.success\(done\)/);
  });

  it.each(SHARED_SUBMITTERS)(
    "%s hardcodes no message in the helper",
    (file) => {
      const src = read(file);
      const helper = src.slice(
        src.indexOf("function run("),
        src.indexOf("return ("),
      );
      expect(helper).not.toMatch(/toast\.success\("/);
    },
  );
});

describe("the specific messages that were wrong", () => {
  it("deleting a task no longer claims it was updated", () => {
    const src = read("components/tasks/TaskDetail.tsx");
    expect(src).toContain('"Task deleted."');
    // The update wording survives, but only on the form that updates.
    const updates = src.match(/run\(saveDetails, data, "Task updated\."\)/);
    expect(updates).not.toBeNull();
  });

  it("removing a saved link no longer claims it was saved", () => {
    const src = read("components/explore/LinkDetail.tsx");
    expect(src).toContain('run(archiveLink, "Removed from Explore.")');
  });

  it("removing a reward no longer just says Done", () => {
    const src = read("components/rewards/RewardList.tsx");
    expect(src).toContain('"Reward removed."');
    expect(src).not.toContain('toast.success("Done.")');
  });

  it("completing and un-completing say different things", () => {
    // Collapsed, because prettier may wrap the ternary across lines.
    const src = read("components/tasks/TaskDetail.tsx").replace(/\s+/g, " ");
    expect(src).toContain('task.done ? "Put back on your list."');
    expect(src).toMatch(/toggleTask, data, task\.done \?/);
  });
});
