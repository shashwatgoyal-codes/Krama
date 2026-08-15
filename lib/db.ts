import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Connects through Neon's *pooled* endpoint (host contains "-pooler").
 *
 * One consequence worth knowing: the pooled endpoint runs transaction
 * pooling, so Prisma's interactive `$transaction(async tx => …)` is
 * unreliable through it — statements can land on different backends.
 * Anything that must be atomic is a single SQL statement or a plpgsql
 * function called with $queryRaw.
 *
 * The client is created on first use, not on import. Next collects page
 * data at build time, and a build shouldn't need a live database.
 */

declare global {
  var __kramaDb: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your " +
        "Neon pooled connection string (the host containing '-pooler').",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function client(): PrismaClient {
  // Reused across hot reloads in development, so file saves don't
  // exhaust Neon's connection limit with a new pool each time.
  if (!globalThis.__kramaDb) globalThis.__kramaDb = createClient();
  return globalThis.__kramaDb;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(client(), prop, receiver);
    return typeof value === "function" ? value.bind(client()) : value;
  },
});
