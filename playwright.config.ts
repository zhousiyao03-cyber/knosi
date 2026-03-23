import { defineConfig } from "@playwright/test";
import {
  PLAYWRIGHT_DB_PATH,
  PLAYWRIGHT_PNPM_BIN,
  PLAYWRIGHT_RUNTIME_PATH,
} from "./e2e/test-db";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: "./e2e/global-setup.ts",
  reporter: "html",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: `${PLAYWRIGHT_PNPM_BIN} dev --port 3100`,
    env: {
      ...process.env,
      PATH: PLAYWRIGHT_RUNTIME_PATH,
      SQLITE_DB_PATH: PLAYWRIGHT_DB_PATH,
    },
    url: "http://localhost:3100/api/trpc/notes.list?input=%7B%7D",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
