import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withVerifiedSsl } from "@/lib/neon";

/**
 * The database connection the admin portal uses.
 *
 * It is a different Postgres role from the one the app runs as, with
 * SELECT granted only on the columns an administrator has any business
 * seeing — ids, counts, timestamps, status. Not the body of a note, not
 * the title of a task, not the text of anything.
 *
 * The point of doing it here rather than by being careful in the query
 * is that being careful does not survive contact with a codebase. One
 * new endpoint, one findMany without a select, one debugging line left
 * in, and content is on a screen it should never reach. With the grant
 * withheld, that query does not return the wrong data — it fails, loudly
 * and immediately, which is what you want from a mistake like that.
 *
 * ADMIN_DATABASE_URL is optional. Without it the portal refuses to run
 * rather than falling back to the unrestricted connection: a seal that
 * silently opens when misconfigured is not a seal.
 */

declare global {
  var __kramaAdminDb: PrismaClient | undefined;
}

export class AdminDbUnavailable extends Error {
  constructor() {
    super(
      "ADMIN_DATABASE_URL is not set. The admin portal needs its own " +
        "restricted Postgres role — see docs/ADMIN.md. It will not fall " +
        "back to the application's connection.",
    );
    this.name = "AdminDbUnavailable";
  }
}

export function adminDbConfigured(): boolean {
  return Boolean(process.env.ADMIN_DATABASE_URL);
}

function createAdminClient(): PrismaClient {
  const url = process.env.ADMIN_DATABASE_URL;
  if (!url) throw new AdminDbUnavailable();
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: withVerifiedSsl(url) }),
  });
}

function client(): PrismaClient {
  if (!globalThis.__kramaAdminDb) globalThis.__kramaAdminDb = createAdminClient();
  return globalThis.__kramaAdminDb;
}

/** Lazily constructed, so a build never needs a database. */
export const adminDb: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(client(), prop, receiver);
    return typeof value === "function" ? value.bind(client()) : value;
  },
});
