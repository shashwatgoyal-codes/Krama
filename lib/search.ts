/**
 * Parsing what someone typed into the search box.
 *
 * Search is the one place where a person types a sentence and expects a
 * machine to guess correctly, so the grammar has to be small enough to
 * learn by accident:
 *
 *   deep work            free text
 *   tag:learning         only things carrying that tag
 *   is:task is:note      only those kinds
 *   "exact phrase"       words that must appear together
 *   -draft               things that do not mention this
 *
 * Anything unrecognised is treated as free text rather than rejected. A
 * search box that argues with you is worse than one that finds slightly
 * too much.
 *
 * IMPORTANT: no repository imports here — this file is used by client
 * components, and importing one drags Prisma into the browser bundle.
 * Pure functions only.
 */

import { TAGGABLE, isTaggable, normaliseTagName, type Taggable } from "./tags";

export type SearchQuery = {
  /** Words that must appear, already lowercased. */
  terms: string[];
  /** Phrases that must appear intact. */
  phrases: string[];
  /** Words that must NOT appear. */
  excluded: string[];
  /** Tag names the result must carry (all of them). */
  tags: string[];
  /** Kinds to look in. Empty means everything. */
  kinds: Taggable[];
  /** True when there is nothing to search for. */
  empty: boolean;
};

export const SEARCHABLE = TAGGABLE;

/** Longest query we will parse. Past this it is a paste, not a search. */
export const QUERY_MAX_LENGTH = 200;

/**
 * Pulls out quoted phrases first, so a phrase containing "tag:" or a
 * space is not torn apart by the token rules that follow.
 */
function takePhrases(raw: string): { rest: string; phrases: string[] } {
  const phrases: string[] = [];
  const rest = raw.replace(/"([^"]*)"/g, (_, inner: string) => {
    const phrase = inner.trim().toLowerCase();
    if (phrase) phrases.push(phrase);
    return " ";
  });
  return { rest, phrases };
}

export function parseQuery(raw: string): SearchQuery {
  const input = (raw ?? "").slice(0, QUERY_MAX_LENGTH);
  const { rest, phrases } = takePhrases(input);

  const terms: string[] = [];
  const excluded: string[] = [];
  const tags: string[] = [];
  const kinds: Taggable[] = [];

  for (const token of rest.split(/\s+/)) {
    if (!token) continue;

    if (token.toLowerCase().startsWith("tag:")) {
      const name = normaliseTagName(token.slice(4));
      if (name) tags.push(name.toLowerCase());
      continue;
    }

    if (token.toLowerCase().startsWith("is:")) {
      const kind = token.slice(3).toLowerCase().replace(/s$/, "");
      if (isTaggable(kind) && !kinds.includes(kind)) kinds.push(kind);
      continue;
    }

    // A bare "-" is someone mid-typing, not an exclusion of nothing.
    if (token.startsWith("-") && token.length > 1) {
      excluded.push(token.slice(1).toLowerCase());
      continue;
    }

    terms.push(token.toLowerCase());
  }

  return {
    terms,
    phrases,
    excluded,
    tags,
    kinds,
    empty:
      terms.length === 0 &&
      phrases.length === 0 &&
      tags.length === 0 &&
      // Any operator on its own is a real search. "is:note" asks to see
      // your notes and "-draft" asks for everything that isn't one;
      // both are questions, even with no plain words in them. Counting
      // some operators and not others would make the search box answer
      // one typed query and ignore another for no visible reason.
      excluded.length === 0 &&
      kinds.length === 0,
  };
}

/** Which kinds this query should actually read. */
export function kindsToSearch(query: SearchQuery): Taggable[] {
  return query.kinds.length > 0 ? query.kinds : [...SEARCHABLE];
}

/**
 * Whether one piece of text satisfies the word rules.
 *
 * Deliberately substring rather than whole-word: "meet" should find
 * "meeting", because someone searching their own notes is usually half
 * remembering a word, not quoting it.
 */
export function textMatches(haystack: string, query: SearchQuery): boolean {
  const text = haystack.toLowerCase();

  for (const phrase of query.phrases) {
    if (!text.includes(phrase)) return false;
  }
  for (const term of query.terms) {
    if (!text.includes(term)) return false;
  }
  for (const term of query.excluded) {
    if (text.includes(term)) return false;
  }
  return true;
}

/** Whether a row's tags satisfy the tag rules. All must be present. */
export function tagsMatch(
  rowTags: { name: string }[],
  query: SearchQuery,
): boolean {
  if (query.tags.length === 0) return true;
  const have = new Set(rowTags.map((t) => t.name.toLowerCase()));
  return query.tags.every((t) => have.has(t));
}

/**
 * How well a result matches, for ordering. Higher is better.
 *
 * A title hit beats a body hit because a note whose first line is what
 * you typed is almost always the one you meant. Exact equality beats a
 * prefix, which beats a mention anywhere.
 */
export function scoreMatch(
  title: string,
  body: string,
  query: SearchQuery,
): number {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  const needles = [...query.phrases, ...query.terms];
  if (needles.length === 0) return 1;

  // The exact and prefix bonuses are judged against the whole query, not
  // each word in turn. Per-word they punished the better result: for
  // "deep work", a note titled "deep work" scored 50 for the prefix plus
  // 25 for the mention, while one merely titled "deep" scored a full 100
  // for matching one word exactly — so covering half the query beat
  // covering all of it.
  const whole = needles.join(" ");
  let score = 0;
  if (t === whole) score += 100;
  else if (t.startsWith(whole)) score += 50;

  for (const needle of needles) {
    if (t.includes(needle)) score += 25;
    else if (b.includes(needle)) score += 5;
  }
  return score;
}

/**
 * A short piece of the body centred on the first hit, so the result
 * explains itself rather than making you open it to find out why it is
 * there.
 */
export function excerpt(body: string, query: SearchQuery, width = 90): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= width) return flat;

  const needle = [...query.phrases, ...query.terms][0];
  const at = needle ? flat.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return flat.slice(0, width).trimEnd() + "…";

  const start = Math.max(0, at - Math.floor((width - needle.length) / 2));
  const end = Math.min(flat.length, start + width);
  return (
    (start > 0 ? "…" : "") +
    flat.slice(start, end).trim() +
    (end < flat.length ? "…" : "")
  );
}
