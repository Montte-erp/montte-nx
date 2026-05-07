import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
   testDir: "./tests",
   fullyParallel: false,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 1 : 0,
   workers: 1,
   reporter: process.env.CI ? "github" : "list",
   timeout: 60_000,
   expect: { timeout: 10_000 },
   use: {
      baseURL: BASE_URL,
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
   },
   projects: [
      {
         name: "setup",
         testMatch: /.*\.setup\.ts/,
      },
      {
         name: "chromium",
         use: {
            ...devices["Desktop Chrome"],
            storageState: "./.auth/user.json",
         },
         dependencies: ["setup"],
         testIgnore: /.*\.setup\.ts/,
      },
   ],
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
