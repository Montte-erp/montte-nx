import { expect, test } from "../fixtures";

test("sort + pagination state syncs to URL and survives reload", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/transactions`,
   );
   await expect(
      page.getByRole("heading", { name: "Lançamentos" }),
   ).toBeVisible();

   const dateHeader = page.getByRole("cell", { name: "Data" }).first();
   await dateHeader.click();
   await page.waitForURL(/sorting=/);
   expect(page.url()).toContain("sorting=");

   await page.reload();
   await expect(
      page.getByRole("heading", { name: "Lançamentos" }),
   ).toBeVisible();
   expect(page.url()).toContain("sorting=");

   const pageSizeSelect = page
      .getByRole("combobox")
      .filter({ hasText: /\d+/ })
      .first();
   await pageSizeSelect.click();
   await page.getByRole("option", { name: "50" }).click();
   await page.waitForURL(/pageSize=50/);
   expect(page.url()).toContain("pageSize=50");
});
