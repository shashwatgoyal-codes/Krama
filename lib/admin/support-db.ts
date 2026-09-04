import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withVerifiedSsl } from "@/lib/neon";

/**
 * The only connection in the system that can read what somebody wrote.
 *
 * A third Postgres role, separate from both the app's and the admin
 * portal's. The portal's role has no grant on content at all and never
 * will; this one does, and exactly one code path uses it — the support
 * viewer, which refuses to run without a live, approved, unexpired,
 * unrevoked consent record naming the scope being read.
 *
 * Splitting it this way is the point. If unsealing were a flag on the
 * admin connection, then every admin query would be one bug away from
 * returning content. Here the capability lives in a file you can read
 * end to end, and everything else in the portal is physically incapable
 * of it regardless of what the code says.
 *
 * SUPPORT_DATABASE_URL is optional. Without it the viewer refuses rather
 * than falling back to a connection that would work — a door that opens
 * when the lock is missing is not a door.
 */

declare global {
  var __kramaSupportDb: PrismaClient | undefined;
}

export class SupportDbUnavailable extends Error {
  constructor() {
    super(
      "SUPPORT_DATABASE_URL is not set. Reading a user's content needs its " +
        "own Postgres role — see docs/ADMIN.md. It will not fall back to " +
        "another connection.",
    );
    this.name = "SupportDbUnavailable";
  }
}

export function supportDbConfigured(): boolean {
  return Boolean(process.env.SUPPORT_DATABASE_URL);
}

function createSupportClient(): PrismaClient {
  const url = process.env.SUPPORT_DATABASE_URL;
  if (!url) throw new SupportDbUnavailable();
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: withVerifiedSsl(url) }),
  });
}

function client(): PrismaClient {
  if (!globalThis.__kramaSupportDb) {
    globalThis.__kramaSupportDb = createSupportClient();
  }
  return globalThis.__kramaSupportDb;
}

/** Never import this outside lib/admin/support.ts. */
export const supportDb: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(client(), prop, receiver);
    return typeof value === "function" ? value.bind(client()) : value;
  },
});
