import { defineConfig } from "vitest/config";

/**
 * Two suites, deliberately separate.
 *
 * The unit suite is pure: no database, no network, milliseconds to run,
 * and safe on any machine. The integration suite talks to a real
 * Postgres, because the things that actually broke in this project were
 * not arithmetic — they were queries that quietly matched nothing, a
 * template appearing in a list it should not, an ownership check that
 * was never reached. None of that is visible with Prisma mocked.
 *
 * Splitting them means the fast one stays fast and can run anywhere,
 * and the slow one can be pointed at whichever database the environment
 * provides.
 */
export default defineConfig({
  // Vite resolves the "@/*" paths from tsconfig natively — no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/integration/**"],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.int.test.ts"],
          // One at a time. They share a database, and a suite that
          // passes only when the machine is fast is not a suite.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
