import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  sendFeedback,
  listMyFeedback,
  withdrawFeedback,
} from "@/lib/repositories/feedback";
import { makeUser, cleanupAll } from "./harness";

/**
 * Feedback is the one thing a person writes that somebody else may read.
 *
 * So the boundaries around it are worth checking against the real
 * database rather than reasoning about: that it is yours until it is
 * read, that it stops being yours to withdraw afterwards, and that one
 * account never sees another's.
 */

afterAll(cleanupAll);

describe("sending", () => {
  it("stores the message and shows it back", async () => {
    const user = await makeUser("fb-send");
    await sendFeedback({
      userId: user.id,
      kind: "problem",
      message: "  The routine shows twice.  ",
      fromPath: "/app/calendar",
    });

    const mine = await listMyFeedback(user.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].message).toBe("The routine shows twice.");
    expect(mine[0].status).toBe("new");
    expect(mine[0].reply).toBeNull();
  });

  it("keeps a path we recognise and drops one we do not", async () => {
    const user = await makeUser("fb-path");
    const a = await sendFeedback({ userId: user.id, kind: "idea", message: "One", fromPath: "/app/notes?q=secret" });
    const b = await sendFeedback({ userId: user.id, kind: "idea", message: "Two", fromPath: "https://elsewhere.example/app" });

    const rows = await db.feedback.findMany({
      where: { id: { in: [a, b] } },
      select: { id: true, fromPath: true },
    });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.fromPath]));
    expect(byId[a]).toBe("/app/notes");
    expect(byId[b]).toBeNull();
  });
});

describe("taking it back", () => {
  it("works while nobody has read it", async () => {
    const user = await makeUser("fb-withdraw");
    const id = await sendFeedback({ userId: user.id, kind: "idea", message: "Never mind." });

    expect(await withdrawFeedback(user.id, id)).toBe(true);
    expect(await listMyFeedback(user.id)).toHaveLength(0);
  });

  it("refuses once it has been read", async () => {
    const user = await makeUser("fb-read");
    const id = await sendFeedback({ userId: user.id, kind: "problem", message: "Something is wrong." });
    await db.feedback.update({ where: { id }, data: { status: "read" } });

    expect(await withdrawFeedback(user.id, id)).toBe(false);
    expect(await listMyFeedback(user.id)).toHaveLength(1);
  });

  it("refuses somebody else's, without saying whether it exists", async () => {
    const mine = await makeUser("fb-owner");
    const other = await makeUser("fb-stranger");
    const id = await sendFeedback({ userId: mine.id, kind: "idea", message: "My own message." });

    expect(await withdrawFeedback(other.id, id)).toBe(false);
    expect(await listMyFeedback(mine.id)).toHaveLength(1);
  });
});

describe("what each account can see", () => {
  it("never returns another account's messages", async () => {
    const a = await makeUser("fb-a");
    const b = await makeUser("fb-b");
    await sendFeedback({ userId: a.id, kind: "idea", message: "From A." });
    await sendFeedback({ userId: b.id, kind: "idea", message: "From B." });

    expect((await listMyFeedback(a.id)).map((f) => f.message)).toEqual(["From A."]);
    expect((await listMyFeedback(b.id)).map((f) => f.message)).toEqual(["From B."]);
  });

  it("shows a reply once one is written", async () => {
    const user = await makeUser("fb-reply");
    const id = await sendFeedback({ userId: user.id, kind: "problem", message: "Please fix this." });
    await db.feedback.update({
      where: { id },
      data: { reply: "Fixed in today's release.", status: "done", handledBy: "admin@krama.invalid" },
    });

    const [row] = await listMyFeedback(user.id);
    expect(row.reply).toBe("Fixed in today's release.");
    expect(row.status).toBe("done");
  });
});

describe("deleting the account", () => {
  it("takes the feedback with it", async () => {
    const user = await makeUser("fb-cascade");
    await sendFeedback({ userId: user.id, kind: "idea", message: "Goodbye." });
    await db.user.delete({ where: { id: user.id } });

    expect(await db.feedback.count({ where: { userId: user.id } })).toBe(0);
  });
});
