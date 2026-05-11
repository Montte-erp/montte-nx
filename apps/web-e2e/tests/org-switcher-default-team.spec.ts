import { expect, test } from "../fixtures";
import { createAdditionalOrganization } from "../features/auth";

test("seleciona team default ao trocar de organização pelo switcher", async ({
   page,
   e2eSession,
}) => {
   const workspace = `E2E Switcher ${Date.now()}`;
   const second = await createAdditionalOrganization(page, workspace);
   expect(second.orgSlug).not.toBe(e2eSession.orgSlug);

   await page.goto(`/${second.orgSlug}/${second.teamSlug}/inbox`);

   const switcher = page
      .getByRole("button")
      .filter({ hasText: workspace })
      .first();
   await expect(switcher).toBeVisible({ timeout: 15_000 });
   await switcher.click();

   await page.getByText("Organização", { exact: true }).first().hover();
   await expect(
      page.getByRole("menuitem", { name: e2eSession.orgSlug, exact: false }),
   ).toBeVisible();

   const orgItem = page.getByRole("menuitem").filter({
      hasText: new RegExp(e2eSession.orgSlug.replace(/-/g, ".?"), "i"),
   });
   await orgItem.first().click();

   await page.waitForURL(
      (url) =>
         url.pathname.startsWith(
            `/${e2eSession.orgSlug}/${e2eSession.teamSlug}`,
         ),
      { timeout: 15_000 },
   );

   await expect(page.getByText("Sem espaço")).toHaveCount(0);
});

test("cria novo espaço pelo switcher e navega para ele", async ({ page }) => {
   await page.goto("/");
   await page.waitForURL(/^\/(?!auth\/)[^/]+\/[^/]+\//, { timeout: 15_000 });

   const switcher = page.getByTestId("sidebar-scope-switcher");
   await switcher.click();

   await page.getByRole("menuitem", { name: /Sem espaço|Principal|espaço/i });
   const subTrigger = page.getByRole("menuitem").first();
   await subTrigger.hover();

   const newProjectItem = page.getByRole("menuitem", { name: /Novo espaço/i });
   await newProjectItem.click();

   const newName = `Espaço E2E ${Date.now()}`;
   await page.getByRole("textbox", { name: /Nome do espaço/i }).fill(newName);
   await page.getByRole("button", { name: /Criar espaço/i }).click();

   const expectedFragment = newName.toLowerCase().replace(/[^a-z0-9]/g, "");

   await page.waitForURL(
      (url) =>
         url.pathname
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .includes(expectedFragment),
      { timeout: 20_000 },
   );
});
