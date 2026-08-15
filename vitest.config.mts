import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves the "@/*" paths from tsconfig natively — no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
