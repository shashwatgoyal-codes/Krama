/**
 * One label system, shared by tasks, notes, events and saved links.
 *
 * Tags used to exist twice. There was a `tags` table you could manage in
 * Settings — name it, colour it, review the unused ones — and separately
 * a `String[]` on links that never referenced that table. So an
 * "interviews" tag created in Settings and an "interviews" typed onto a
 * link were different things wearing the same word, and neither could
 * reach a task. This module is the vocabulary both sides now speak.
 *
 * IMPORTANT: nothing here may import from lib/repositories/*. This file
 * is imported by client components, and pulling a repository in drags
 * Prisma, pg, net and tls into the browser bundle. That mistake passes
 * both tsc and eslint and only shows up as a blank page at runtime.
 * Types and pure functions only.
 */

/** A tag as any UI needs it — never the whole row. */
export type TagChip = {
  id: string;
  name: string;
  colour: string;
};

/** The content types a tag can be attached to. */
export const TAGGABLE = ["task", "note", "event", "link"] as const;
export type Taggable = (typeof TAGGABLE)[number];

export function isTaggable(value: string): value is Taggable {
  return (TAGGABLE as readonly string[]).includes(value);
}

/** The longest a tag name may be. Long enough to be a phrase, short
 *  enough to stay a chip rather than becoming a sentence. */
export const TAG_MAX_LENGTH = 32;

/**
 * Tags are matched case-insensitively but shown as they were typed.
 *
 * "Interviews" and "interviews" being two tags is the classic way a tag
 * list turns to noise — you end up with three spellings of the same idea
 * and a filter that finds a third of what it should.
 */
export function normaliseTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, TAG_MAX_LENGTH);
}

/** The key two names are compared on. Display keeps the original. */
export function tagKey(name: string): string {
  return normaliseTagName(name).toLowerCase();
}

export function sameTag(a: string, b: string): boolean {
  return tagKey(a) === tagKey(b);
}

/**
 * Splits what someone typed into tag names.
 *
 * Commas are the separator people reach for without being told, so it is
 * the one this accepts. Empty pieces are dropped rather than becoming
 * blank tags, and duplicates within one entry collapse.
 */
export function parseTagInput(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const piece of raw.split(",")) {
    const name = normaliseTagName(piece);
    if (!name) continue;
    const key = tagKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}

/** Whether a name could be a tag at all. */
export function isValidTagName(raw: string): boolean {
  const name = normaliseTagName(raw);
  return name.length > 0 && name.length <= TAG_MAX_LENGTH;
}

/**
 * Merges a chosen set with what is already attached, case-insensitively.
 * Order is preserved so the list doesn't reshuffle as you edit it.
 */
export function mergeTags(current: string[], adding: string[]): string[] {
  const out = [...current];
  const seen = new Set(current.map(tagKey));

  for (const name of adding) {
    const key = tagKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}

export function removeTag(current: string[], name: string): string[] {
  return current.filter((t) => !sameTag(t, name));
}

/** Sorted for display: alphabetical, case-insensitive, stable. */
export function sortTags<T extends { name: string }>(tags: T[]): T[] {
  return [...tags].sort((a, b) =>
    tagKey(a.name).localeCompare(tagKey(b.name)),
  );
}
