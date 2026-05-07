import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

type Session = { orgSlug: string; teamSlug: string };

const session = JSON.parse(
   fs.readFileSync(
      path.join(import.meta.dirname, "..", ".auth", "session.json"),
      "utf8",
   ),
) as Session;

const FIXTURE = path.join(import.meta.dirname, "fixtures", "logo.png");

test("upload organization logo", async ({ page }) => {
   await page.goto(
      `/${session.orgSlug}/${session.teamSlug}/settings/organization/general`,
   );

   await expect(page.getByTestId("logo-section")).toBeVisible();

   const fileChooserPromise = page.waitForEvent("filechooser");
   await page.getByText("Clique ou arraste para enviar").click();
   const chooser = await fileChooserPromise;
   await chooser.setFiles(FIXTURE);

   const saveBtn = page.getByTestId("save-logo-button");
   await expect(saveBtn).toBeVisible();

   const uploadResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/upload") && r.request().method() === "POST",
   );
   await saveBtn.click();

   const res = await uploadResponse;
   expect(res.status(), `upload route status ${res.status()}`).toBe(200);

   await expect(page.getByText("Logo atualizado com sucesso!")).toBeVisible();
});
