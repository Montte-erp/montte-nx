import { expect, test as setup } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const authFile = path.join(import.meta.dirname, "..", ".auth", "user.json");
const sessionFile = path.join(
   import.meta.dirname,
   "..",
   ".auth",
   "session.json",
);

setup("authenticate", async ({ page }) => {
   fs.mkdirSync(path.dirname(authFile), { recursive: true });

   const res = await page.request.post("/api/dev/seed-e2e", { data: {} });
   expect(res.ok(), `seed failed: ${await res.text()}`).toBeTruthy();
   const session = (await res.json()) as {
      email: string;
      orgSlug: string;
      teamSlug: string;
   };

   await page.context().storageState({ path: authFile });
   fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
});
