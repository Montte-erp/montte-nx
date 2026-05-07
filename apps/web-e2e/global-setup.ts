import { chromium, type FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { signUpAndOnboard } from "./features/auth";

export const AUTH_FILE = path.join(import.meta.dirname, ".auth", "user.json");
export const SESSION_FILE = path.join(
   import.meta.dirname,
   ".auth",
   "session.json",
);

export default async function globalSetup(config: FullConfig) {
   fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

   const baseURL =
      config.projects[0]?.use.baseURL ??
      process.env.E2E_BASE_URL ??
      "http://localhost:3000";

   const browser = await chromium.launch();
   const context = await browser.newContext({ baseURL });
   const page = await context.newPage();

   const { user, orgSlug, teamSlug } = await signUpAndOnboard(page);

   await context.storageState({ path: AUTH_FILE });
   fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify({ email: user.email, orgSlug, teamSlug }, null, 2),
   );

   await browser.close();
}
