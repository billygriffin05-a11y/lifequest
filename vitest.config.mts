import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // "server-only" throws outside the Next.js server bundle; neutralise it in tests.
      "server-only": path.resolve(root, "tests/support/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    env: { LIFEQUEST_ENV: "test" },
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts"],
      exclude: ["src/generated/**"],
    },
  },
});
