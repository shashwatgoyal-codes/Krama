import { describe, it, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { search } from "@/lib/repositories/search";
import { setTagsOn } from "@/lib/repositories/tags";
import { parseQuery } from "@/lib/search";
import { makeUser, cleanup, dayDate, DAY, type TestUser } from "./harness";

/**
 * Search against real rows.
 *
 * The grammar is unit-tested. What needs a database is the part that was
 * actually wrong: only the first term reached Postgres, so "deep work"
 * returned everything containing "deep" until the precise rules were
 * applied to what came back. That bug is invisible without data.
 */

let user: TestUser | null = null;
afterEach(async () => {
  await cleanup(user);
  user = null;
});

async function seed(userId: string) {
  await db.task.create({
    data: {
      userId,
      title: "Deep work session",
      notes: "Two hours on the migration",
      points: 30,
      createdForDate: dayDate(DAY.monday),
    },
  });
  await db.task.create({
    data: {
      userId,
      title: "Shallow admin",
      notes: "Expenses",
      points: 5,
      createdForDate: dayDate(DAY.monday),
    },
  });
  await db.note.create({
    data: {
      userId,
      body: "A note about deep thinking",
      colour: "n1",
      x: 0,
      y: 0,
      z: 0,
    },
  });
  await db.link.create({
    data: {
      userId,
      url: "https://example.invalid/deep",
      title: "An article",
      description: "About deep systems",
      source: "example.invalid",
    },
  });
  await db.event.create({
    data: {
      userId,
      title: "Deep review meeting",
      startsAt: new Date("2026-08-17T09:00:00Z"),
      endsAt: new Date("2026-08-17T10:00:00Z"),
    },
  });
}

const find = (userId: string, q: string) => search(userId, parseQuery(q));

describe("finding things across every kind", () => {
  it("finds a task by its title", async () => {
    user = await makeUser("search-task");
    await seed(user.id);
    const hits = await find(user.id, "shallow");
    expect(hits.map((h) => h.kind)).toEqual(["task"]);
  });

  it("finds a task by its notes, not only its title", async () => {
    user = await makeUser("search-notes");
    await seed(user.id);
    const hits = await find(user.id, "expenses");
    expect(hits).toHaveLength(1);
  });

  it("reaches notes, links and events too", async () => {
    user = await makeUser("search-kinds");
    await seed(user.id);
    const kinds = new Set((await find(user.id, "deep")).map((h) => h.kind));
    expect(kinds.has("task")).toBe(true);
    expect(kinds.has("note")).toBe(true);
    expect(kinds.has("link")).toBe(true);
    expect(kinds.has("event")).toBe(true);
  });

  it("requires every term, not just the first", async () => {
    // The bug: only one needle reached the database, so a second term
    // that matched nothing was silently ignored.
    user = await makeUser("search-and");
    await seed(user.id);
    expect(await find(user.id, "deep zzzznothing")).toEqual([]);
  });

  it("matches a phrase only when it appears intact", async () => {
    user = await makeUser("search-phrase");
    await seed(user.id);
    expect((await find(user.id, '"deep work"')).length).toBeGreaterThan(0);
    expect(await find(user.id, '"work deep"')).toEqual([]);
  });

  it("excludes what is asked to be excluded", async () => {
    user = await makeUser("search-not");
    await seed(user.id);
    const hits = await find(user.id, "deep -session");
    expect(hits.every((h) => !h.title.toLowerCase().includes("session"))).toBe(
      true,
    );
  });

  it("narrows to one kind with is:", async () => {
    user = await makeUser("search-is");
    await seed(user.id);
    const hits = await find(user.id, "is:note deep");
    expect(hits.map((h) => h.kind)).toEqual(["note"]);
  });

  it("is case-insensitive", async () => {
    user = await makeUser("search-case");
    await seed(user.id);
    const lower = await find(user.id, "deep");
    const upper = await find(user.id, "DEEP");
    expect(upper.length).toBe(lower.length);
  });

  it("finds nothing for an empty query rather than everything", async () => {
    user = await makeUser("search-empty");
    await seed(user.id);
    expect(await find(user.id, "")).toEqual([]);
    expect(await find(user.id, "   ")).toEqual([]);
  });

  it("never returns another account's rows", async () => {
    user = await makeUser("search-mine");
    const other = await makeUser("search-theirs");
    try {
      await seed(other.id);
      expect(await find(user.id, "deep")).toEqual([]);
    } finally {
      await cleanup(other);
    }
  });
});

describe("filtering by tag", () => {
  it("returns only what carries the tag", async () => {
    user = await makeUser("search-tag");
    await seed(user.id);
    const task = await db.task.findFirst({
      where: { userId: user.id, title: "Shallow admin" },
      select: { id: true },
    });
    await setTagsOn(user.id, "task", task!.id, ["admin"]);

    const hits = await find(user.id, "tag:admin");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.title).toBe("Shallow admin");
  });

  it("matches the tag case-insensitively", async () => {
    user = await makeUser("search-tagcase");
    await seed(user.id);
    const task = await db.task.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    await setTagsOn(user.id, "task", task!.id, ["Admin"]);
    expect((await find(user.id, "tag:admin")).length).toBe(1);
  });

  it("returns nothing for a tag nobody has", async () => {
    user = await makeUser("search-notag");
    await seed(user.id);
    expect(await find(user.id, "tag:nosuchtag")).toEqual([]);
  });

  it("carries the tags back on each hit", async () => {
    user = await makeUser("search-tagback");
    await seed(user.id);
    const task = await db.task.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    await setTagsOn(user.id, "task", task!.id, ["carried"]);
    const hits = await find(user.id, "tag:carried");
    expect(hits[0]!.tags.map((t) => t.name)).toEqual(["carried"]);
  });
});
