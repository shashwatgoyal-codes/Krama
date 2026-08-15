/**
 * Neon hands out two connection strings, but they are the same URL with
 * one difference: the pooled host contains "-pooler".
 *
 *   pooled  postgresql://user:pw@ep-abc-123-pooler.ap-south-1.aws.neon.tech/db
 *   direct  postgresql://user:pw@ep-abc-123.ap-south-1.aws.neon.tech/db
 *
 * So only one needs to be configured — the other is derived. That also
 * removes a whole class of mistake: pasting the pooled string into the
 * direct slot produces a migration failure whose message says nothing
 * about pooling.
 */

const POOLER = "-pooler";

/** The direct endpoint. Migrations must use this — a pooler can't run DDL. */
export function toDirectUrl(url: string): string {
  if (!url) return "";
  return url.replace(`${POOLER}.`, ".");
}

/** The pooled endpoint. The running app should use this. */
export function toPooledUrl(url: string): string {
  if (!url) return "";
  if (url.includes(`${POOLER}.`)) return url;
  // Insert "-pooler" into the first host label, leaving credentials
  // (which may contain dots) untouched.
  return url.replace(/@([^.@/]+)\./, `@$1${POOLER}.`);
}

export function isPooled(url: string): boolean {
  return url.includes(`${POOLER}.`);
}
