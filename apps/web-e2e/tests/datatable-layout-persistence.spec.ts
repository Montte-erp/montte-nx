import { expect, test } from "../fixtures";

test("column visibility toggle persists in localStorage across reload", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/bank-accounts`,
   );
   await expect(
      page.getByRole("heading", { name: "Contas Bancárias" }),
   ).toBeVisible();

   await page.getByRole("button", { name: "Colunas" }).click();
   const toggle = page.getByRole("menuitem").nth(1);
   const label = (await toggle.textContent())?.trim() ?? "";
   await toggle.click();
   await page.keyboard.press("Escape");

   await expect(
      page.getByRole("cell", { name: label, exact: true }).first(),
   ).toHaveCount(0);

   const stored = await page.evaluate(() =>
      window.localStorage.getItem("montte:datatable:bank-accounts:layout"),
   );
   expect(stored).toBeTruthy();
   expect(stored).toContain("columnVisibility");

   await page.reload();
   await expect(
      page.getByRole("heading", { name: "Contas Bancárias" }),
   ).toBeVisible();
   await expect(
      page.getByRole("cell", { name: label, exact: true }).first(),
   ).toHaveCount(0);

   await page.getByRole("button", { name: "Colunas" }).click();
   await page.getByRole("menuitem", { name: label }).click();
   await page.keyboard.press("Escape");
});
