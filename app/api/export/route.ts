import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Everything the account contains, as one file.
 *
 * A route rather than a server action because this hands the browser a
 * download, which an action cannot do. It is gated the same way every
 * page is — the session decides whose data this is, never a parameter.
 *
 * There is deliberately no matching import. The reasoning is written on
 * the Data tab: an export carries the points history, and a file can be
 * edited before it is handed back.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const format = new URL(request.url).searchParams.get("format");

  const [profile, areas, tags, tasks, notes, events, links, ledger] =
    await Promise.all([
      db.profile.findUnique({ where: { userId: user.id } }),
      db.area.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } }),
      db.tag.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
      db.task.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      db.note.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      db.event.findMany({ where: { userId: user.id }, orderBy: { startsAt: "asc" } }),
      db.link.findMany({ where: { userId: user.id }, orderBy: { savedAt: "asc" } }),
      db.pointEntry.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    // One file per type would need a zip; a single sheet of tasks is
    // what people actually open a spreadsheet for.
    const rows = [
      ["Title", "Area", "Status", "Points", "Due", "Created for", "Notes"],
      ...tasks.map((t) => [
        t.title,
        areas.find((a) => a.id === t.areaId)?.name ?? "",
        t.status,
        String(t.points),
        t.dueOn?.toISOString().slice(0, 10) ?? "",
        t.createdForDate.toISOString().slice(0, 10),
        t.notes ?? "",
      ]),
    ];

    // A field starting with = + - @ is executed as a formula by Excel
    // and Sheets; prefixing with an apostrophe keeps it as text.
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const safe = /^[=+\-@]/.test(cell) ? `'${cell}` : cell;
            return `"${safe.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="krama-tasks-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email },
    profile,
    areas,
    tags,
    tasks,
    notes,
    events,
    links,
    pointHistory: ledger,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="krama-${stamp}.json"`,
      // Never let a proxy or the browser keep a copy of someone's
      // entire account lying around.
      "Cache-Control": "no-store",
    },
  });
}
