import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
   testDir: "./tests",
   globalSetup: "./global-setup.ts",
   globalTeardown: "./global-teardown.ts",
   fullyParallel: true,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 2 : 0,
   workers: process.env.CI ? 2 : undefined,
   reporter: process.env.CI ? "github" : "list",
   timeout: 60_000,
   expect: { timeout: 10_000 },
   use: {
      baseURL: BASE_URL,
      trace: "on-first-retry",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
   },
   projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
   webServer: process.env.E2E_BASE_URL
      ? undefined
      : {
           command: "bun --filter=web dev",
           cwd: "../..",
           url: BASE_URL,
           reuseExistingServer: !process.env.CI,
           timeout: 180_000,
           stdout: "pipe",
           stderr: "pipe",
        },
});
