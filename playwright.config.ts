import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// E2E tests run against an isolated data directory — never the user's real data.
const E2E_DATA_DIR = path.join(os.tmpdir(), "lifequest-e2e");
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    command: `npx tsx scripts/db.ts migrate && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Blank Google credentials so e2e never talks to Google, even if .env.local has real ones.
    env: { LIFEQUEST_DATA_DIR: E2E_DATA_DIR, LIFEQUEST_ENV: "test", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
  },
});
