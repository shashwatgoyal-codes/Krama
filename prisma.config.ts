import { defineConfig } from "prisma/config";

/**
 * Migrations only. The running app never uses this — it connects through
 * the driver adapter in lib/db.ts against the pooled endpoint.
 *
 * DIRECT_URL must be the Neon host *without* "-pooler": schema changes
 * can't run through a transaction pooler.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
  migrations: {
    path: "prisma/migrations",
  },
});
