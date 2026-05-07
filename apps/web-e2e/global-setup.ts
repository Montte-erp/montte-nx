import { type Browser, chromium, type FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fromPromise } from "neverthrow";
import { ensureE2EUserSession } from "./features/auth";
import { E2E_USER } from "./helpers/auth";

export const AUTH_FILE = path.join(import.meta.dirname, ".auth", "user.json");
export const SESSION_FILE = path.join(
   import.meta.dirname,
   ".auth",
   "session.json",
);

const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

async function runSetup(browser: Browser, baseURL: string) {
   const context = await browser.newContext({ baseURL });
   const page = await context.newPage();

   const { orgSlug, teamSlug } = await ensureE2EUserSession(page, E2E_USER);

   await context.storageState({ path: AUTH_FILE });
   fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify({ email: E2E_USER.email, orgSlug, teamSlug }, null, 2),
   );
}

export default async function globalSetup(config: FullConfig) {
   fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

   const baseURL =
      config.projects[0]?.use.baseURL ??
      process.env.E2E_BASE_URL ??
      "http://localhost:3000";

   const browser = await chromium.launch();
   const result = await fromPromise(runSetup(browser, baseURL), toError);
   await browser.close();
   if (result.isErr()) throw result.error;
}
