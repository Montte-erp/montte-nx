import fs from "node:fs";
import { expect, test } from "../fixtures";

test("exporta membros em CSV", async ({ page, e2eSession }) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/settings/organization/members`,
   );

   await expect(page.getByRole("heading", { name: "Membros" })).toBeVisible();
   await expect(
      page.getByRole("cell", { name: e2eSession.email }).first(),
   ).toBeVisible();

   await page.getByRole("button", { name: "Exportar" }).click();

   const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "Exportar CSV" }).click(),
   ]);
   const downloadPath = await download.path();
   if (!downloadPath) throw new Error("Download CSV não foi salvo.");

   const csv = fs.readFileSync(downloadPath, "utf8");
   expect(download.suggestedFilename()).toMatch(
      /^membros-\d{2}-\d{2}-\d{4}\.csv$/,
   );
   expect(csv).toContain("Nome");
   expect(csv).toContain("E-mail");
   expect(csv).toContain("Função");
   expect(csv).toContain("Desde");
   expect(csv).toContain(e2eSession.email);
   expect(csv.trim().split(/\r?\n/).length).toBeGreaterThan(1);
});
