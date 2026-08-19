/**
 * Neon hands out two connection strings, but they are the same URL with
 * one difference: the pooled host contains "-pooler".
 *
 *   pooled  host is  ep-<name>-pooler.<region>.aws.neon.<tld>
 *   direct  host is  ep-<name>.<region>.aws.neon.<tld>
 *
 * Written as a shape rather than a full connection string on purpose:
 * a realistic-looking one in a comment sets off secret scanners, and an
 * alert that is always a false alarm teaches everyone to ignore the one
 * that is not.
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

/**
 * Forces certificate verification on, whatever the connection string says.
 *
 * pg currently treats sslmode=require as verify-full — the certificate
 * is checked. In pg v9 it adopts libpq semantics, where `require` means
 * "encrypt but don't verify who you're talking to", which is a
 * man-in-the-middle away from useless. The change is silent: the same
 * URL keeps working and quietly stops verifying anything.
 *
 * Rather than depend on everyone remembering to edit an environment
 * variable before that upgrade lands, the app states what it wants.
 * verify-full is what it has been getting all along, so this changes
 * nothing today and prevents a downgrade later.
 */
export function withVerifiedSsl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode");
    // Anything weaker than verify-full is raised to it. `disable` is
    // left alone — that is someone deliberately running without TLS,
    // presumably against a local database, and silently encrypting it
    // would be its own surprise.
    if (mode !== "disable") parsed.searchParams.set("sslmode", "verify-full");
    return parsed.toString();
  } catch {
    return url;
  }
}
