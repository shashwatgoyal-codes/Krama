import { defineConfig } from "prisma/config";
import { toDirectUrl } from "./lib/neon";

/**
 * Migrations only. The running app never uses this — it connects through
 * the driver adapter in lib/db.ts against the pooled endpoint.
 *
 * Only DATABASE_URL needs configuring. Neon's direct and pooled strings
 * differ by "-pooler" in the hostname, so the direct one is derived.
 * Schema changes can't run through a transaction pooler, and a pooled
 * URL in this slot fails with a message that never mentions pooling.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL || toDirectUrl(process.env.DATABASE_URL ?? ""),
  },
  migrations: {
    path: "prisma/migrations",
  },
});
