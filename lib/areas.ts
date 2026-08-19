/**
 * Area constants, safe for the browser.
 *
 * Split from lib/repositories/areas.ts for the same reason lib/notes.ts
 * and BLOCK_MINUTES were split before it: a client component that
 * imports a runtime value from a repository drags Prisma — and through
 * it pg, net, tls, dns — into the browser bundle. It builds fine under
 * tsc and eslint and then fails at runtime with a module-not-found for
 * the whole page.
 *
 * Rule of thumb: anything a "use client" file imports lives in lib/,
 * never in lib/repositories/.
 */

export const AREA_COLOURS = ["acc", "ok", "warn", "bad", "mut"] as const;
export type AreaColour = (typeof AREA_COLOURS)[number];

/**
 * Static class names, because Tailwind reads the source and cannot see a
 * class assembled from a variable at runtime.
 */
export const AREA_DOT: Record<string, string> = {
  acc: "bg-acc",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  mut: "bg-mut",
};

export const AREA_CHIP: Record<string, string> = {
  acc: "border-acc bg-acc-soft text-acc",
  ok: "border-ok bg-ok-soft text-ok",
  warn: "border-warn bg-warn-soft text-warn",
  bad: "border-bad bg-bad-soft text-bad",
  mut: "border-ln2 text-mut",
};
