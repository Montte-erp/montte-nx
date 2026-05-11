import { expect, test } from "../fixtures";

test("popover de filtros em categorias permanece aberto ao alternar opções", async ({
   page,
   e2eSession,
}) => {
   await page.goto(`/${e2eSession.orgSlug}/${e2eSession.teamSlug}/categories`);
   await expect(
      page.getByRole("heading", { name: "Categorias" }),
   ).toBeVisible();

   await page.getByRole("button", { name: "Filtros" }).click();

   const menu = page.getByRole("menu");
   await expect(menu).toBeVisible();

   const archivedItem = menu.getByRole("menuitem", {
      name: /Mostrar arquivadas/,
   });
   await expect(archivedItem).toBeVisible();
   await expect(archivedItem).toBeEnabled();
   await archivedItem.click();
   await expect(menu).toBeVisible();

   const expensesItem = menu.getByRole("menuitem", {
      name: /Somente despesas/,
   });
   await expect(expensesItem).toBeVisible();
   await expect(expensesItem).toBeEnabled();
   await expensesItem.click();
   await expect(menu).toBeVisible();

   await page.mouse.click(10, 10);
   await expect(menu).toBeHidden();
});
