/**
 * What a captured line looks like before anyone decides what it is.
 *
 * Client-safe: no database, no Prisma, so the shortcut dialog can import
 * it without dragging pg and tls into the browser bundle.
 */

/** A pasted URL goes to Explore rather than becoming a task called "https". */
export function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (/\s/.test(t)) return false;
  if (/^https?:\/\/\S+$/i.test(t)) return true;
  // Bare domains people actually paste: example.com/path, www.example.com
  return /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t);
}

/** What the inbox suggests, before you choose. */
export type Suggestion = "link" | "task" | "note";

export function suggest(text: string): Suggestion {
  const t = text.trim();
  if (looksLikeUrl(t)) return "link";
  // A short single line is nearly always something to do; anything with a
  // line break or real length is a thought, not an errand.
  if (t.length <= 80 && !t.includes("\n")) return "task";
  return "note";
}

export const SUGGESTION_LABEL: Record<Suggestion, string> = {
  link: "Save to Explore",
  task: "Make it a task",
  note: "Keep as a note",
};

/** Trimmed, collapsed, and capped — the same shape everywhere. */
export function normaliseCapture(input: string): string {
  return input.replace(/\r\n/g, "\n").trim().slice(0, 1000);
}

export function isCapturable(input: string): boolean {
  return normaliseCapture(input).length > 0;
}
