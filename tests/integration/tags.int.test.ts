import { describe, it, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import {
  setTagsOn,
  resolveTags,
  listTags,
  tagUsage,
} from "@/lib/repositories/tags";
import { makeUser, cleanup, dayDate, DAY, type TestUser } from "./harness";

/**
 * Tags against a real database.
 *
 * The unit tests cover the vocabulary — how names are normalised and
 * compared. What they cannot cover is the part that actually went wrong
 * in practice: whether a name resolves to an existing row rather than
 * founding a rival, whether replacing a list removes what is missing
 * from it, and whether another account's id can reach any of it.
 */

let user: TestUser | null = null;
afterEach(async () => {
  await cleanup(user);
  user = null;
});

async function makeTask(userId: string, title = "A task") {
  return db.task.create({
    data: { userId, title, points: 20, createdForDate: dayDate(DAY.monday) },
    select: { id: true },
  });
}

describe("resolving tag names to rows", () => {
  it("creates a tag that does not exist yet", async () => {
    user = await makeUser("tag-create");
    const tags = await resolveTags(user.id, ["learning"]);
    expect(tags).toHaveLength(1);
    expect(tags[0]!.name).toBe("learning");
  });

  it("reuses an existing tag rather than creating a second", async () => {
    user = await makeUser("tag-reuse");
    const first = await resolveTags(user.id, ["learning"]);
    const second = await resolveTags(user.id, ["learning"]);
    expect(second[0]!.id).toBe(first[0]!.id);
    expect(await listTags(user.id)).toHaveLength(1);
  });

  it("matches case-insensitively and keeps the existing spelling", async () => {
    user = await makeUser("tag-case");
    await resolveTags(user.id, ["learning"]);
    const again = await resolveTags(user.id, ["LEARNING"]);
    expect(again[0]!.name).toBe("learning");
    expect(await listTags(user.id)).toHaveLength(1);
  });

  it("collapses spellings that differ only in spacing", async () => {
    user = await makeUser("tag-space");
    await resolveTags(user.id, ["deep work"]);
    await resolveTags(user.id, ["deep   work"]);
    await resolveTags(user.id, ["  Deep Work  "]);
    expect(await listTags(user.id)).toHaveLength(1);
  });

  it("returns them in the order asked for", async () => {
    user = await makeUser("tag-order");
    const tags = await resolveTags(user.id, ["zeta", "alpha", "mid"]);
    expect(tags.map((t) => t.name)).toEqual(["zeta", "alpha", "mid"]);
  });

  it("ignores blank names", async () => {
    user = await makeUser("tag-blank");
    const tags = await resolveTags(user.id, ["", "   ", "real"]);
    expect(tags).toHaveLength(1);
  });

  it("returns nothing for an empty list", async () => {
    user = await makeUser("tag-empty");
    expect(await resolveTags(user.id, [])).toEqual([]);
  });

  it("keeps one user's tags away from another's", async () => {
    user = await makeUser("tag-mine");
    const other = await makeUser("tag-theirs");
    try {
      await resolveTags(user.id, ["shared-name"]);
      await resolveTags(other.id, ["shared-name"]);
      // Same word, two accounts, two rows — neither can see the other.
      expect(await listTags(user.id)).toHaveLength(1);
      expect(await listTags(other.id)).toHaveLength(1);
      const mine = await listTags(user.id);
      const theirs = await listTags(other.id);
      expect(mine[0]!.id).not.toBe(theirs[0]!.id);
    } finally {
      await cleanup(other);
    }
  });
});

describe("attaching tags to content", () => {
  it("attaches to a task and reads back", async () => {
    user = await makeUser("attach");
    const task = await makeTask(user.id);
    await setTagsOn(user.id, "task", task.id, ["learning", "deep work"]);

    const back = await db.task.findFirst({
      where: { id: task.id },
      select: { tags: { select: { name: true } } },
    });
    expect(back!.tags.map((t) => t.name).sort()).toEqual([
      "deep work",
      "learning",
    ]);
  });

  it("replaces rather than adds, so removal works", async () => {
    user = await makeUser("replace");
    const task = await makeTask(user.id);
    await setTagsOn(user.id, "task", task.id, ["one", "two"]);
    await setTagsOn(user.id, "task", task.id, ["two"]);

    const back = await db.task.findFirst({
      where: { id: task.id },
      select: { tags: { select: { name: true } } },
    });
    expect(back!.tags.map((t) => t.name)).toEqual(["two"]);
  });

  it("clears every tag when given an empty list", async () => {
    user = await makeUser("clear");
    const task = await makeTask(user.id);
    await setTagsOn(user.id, "task", task.id, ["one"]);
    await setTagsOn(user.id, "task", task.id, []);

    const back = await db.task.findFirst({
      where: { id: task.id },
      select: { tags: { select: { name: true } } },
    });
    expect(back!.tags).toEqual([]);
  });

  it("refuses to tag a task belonging to someone else", async () => {
    user = await makeUser("owner");
    const other = await makeUser("intruder");
    try {
      const task = await makeTask(user.id);
      const result = await setTagsOn(other.id, "task", task.id, ["stolen"]);
      expect(result).toBe(null);

      const back = await db.task.findFirst({
        where: { id: task.id },
        select: { tags: true },
      });
      expect(back!.tags).toEqual([]);
    } finally {
      await cleanup(other);
    }
  });

  it("refuses an id that does not exist at all", async () => {
    user = await makeUser("ghost");
    const result = await setTagsOn(
      user.id,
      "task",
      "clzzzzzzzzzzzzzzzzzzzzzzz",
      ["x"],
    );
    expect(result).toBe(null);
  });

  it("attaches to notes, events and links as well as tasks", async () => {
    user = await makeUser("kinds");
    const note = await db.note.create({
      data: { userId: user.id, body: "A note", colour: "n1", x: 0, y: 0, z: 0 },
      select: { id: true },
    });
    const link = await db.link.create({
      data: {
        userId: user.id,
        url: "https://example.invalid/x",
        title: "A link",
        source: "example.invalid",
      },
      select: { id: true },
    });
    const event = await db.event.create({
      data: {
        userId: user.id,
        title: "A block",
        startsAt: new Date("2026-08-17T09:00:00Z"),
        endsAt: new Date("2026-08-17T10:00:00Z"),
      },
      select: { id: true },
    });

    expect(await setTagsOn(user.id, "note", note.id, ["n"])).toHaveLength(1);
    expect(await setTagsOn(user.id, "link", link.id, ["l"])).toHaveLength(1);
    expect(await setTagsOn(user.id, "event", event.id, ["e"])).toHaveLength(1);
  });

  it("counts how many things carry each tag", async () => {
    user = await makeUser("usage");
    const a = await makeTask(user.id, "one");
    const b = await makeTask(user.id, "two");
    await setTagsOn(user.id, "task", a.id, ["shared"]);
    await setTagsOn(user.id, "task", b.id, ["shared"]);

    const tags = await listTags(user.id);
    const usage = await tagUsage(user.id);
    expect(usage[tags[0]!.id]).toBe(2);
  });

  it("records when a tag was last used, for the stale review", async () => {
    user = await makeUser("usedat");
    const task = await makeTask(user.id);
    await setTagsOn(user.id, "task", task.id, ["fresh"]);

    const tag = await db.tag.findFirst({
      where: { userId: user.id },
      select: { usedAt: true },
    });
    expect(tag!.usedAt).not.toBe(null);
  });
});
