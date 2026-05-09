import type { Page } from "@playwright/test";
import { expect, test as base, type E2ESession } from "../fixtures";
import {
   deleteCategoryById,
   findCategoryByName,
   findTeamByOrgAndSlug,
   insertDefaultCategory,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const test = base.extend<{ defaultCategoryIds: string[] }>({
   defaultCategoryIds: async ({}, use) => {
      await use([]);
   },
});

async function gotoCategories(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/categories`);
   await expect(
      page.getByRole("heading", { name: "Categorias" }),
   ).toBeVisible();
}

async function seedDefault(
   session: E2ESession,
   ids: string[],
   name: string,
   type: "income" | "expense" | "transfer" = "expense",
) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) throw new Error("team não encontrado");
   const row = await insertDefaultCategory(team.id, name, type);
   if (!row) throw new Error("falha ao inserir categoria padrão");
   ids.push(row.id);
   return { team, row };
}

async function searchFor(page: Page, name: string) {
   await page.getByRole("textbox", { name: "Buscar categorias..." }).fill(name);
   await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
}

test.afterEach(async ({ e2eSession, defaultCategoryIds }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of defaultCategoryIds.splice(0)) {
      await deleteCategoryById(team.id, id);
   }
});

test("permite renomear categoria padrão inline", async ({
   page,
   e2eSession,
   defaultCategoryIds,
}) => {
   const name = `Padrão E2E ${stamp()}`;
   const renamed = `${name} renomeada`;
   const { team } = await seedDefault(e2eSession, defaultCategoryIds, name);

   await gotoCategories(page, e2eSession);
   await searchFor(page, name);

   const cell = page.getByRole("cell").filter({ hasText: name }).first();
   await cell.click();
   const input = cell.getByRole("textbox");
   await expect(input).toBeVisible();
   await input.fill(renamed);
   await input.press("Enter");

   await expect(
      page.getByRole("row").filter({ hasText: renamed }),
   ).toBeVisible();

   const updated = await findCategoryByName(team.id, renamed);
   expect(updated?.isDefault).toBe(true);
});

test("permite excluir categoria padrão", async ({
   page,
   e2eSession,
   defaultCategoryIds,
}) => {
   const name = `Padrão Excluir ${stamp()}`;
   const { team } = await seedDefault(e2eSession, defaultCategoryIds, name);

   await gotoCategories(page, e2eSession);
   await searchFor(page, name);

   const row = page.getByRole("row").filter({ hasText: name });
   await row.getByRole("button", { name: "Excluir" }).click();

   const dialog = page.getByRole("alertdialog");
   await expect(dialog).toBeVisible();
   await dialog.getByRole("button", { name: "Excluir" }).click();

   await expect(page.getByText(/exclu/i)).toBeVisible();

   const remaining = await findCategoryByName(team.id, name);
   expect(remaining).toBeUndefined();
   defaultCategoryIds.length = 0;
});

test("categoria padrão não exibe botão Arquivar", async ({
   page,
   e2eSession,
   defaultCategoryIds,
}) => {
   const name = `Padrão Sem Arquivar ${stamp()}`;
   await seedDefault(e2eSession, defaultCategoryIds, name);

   await gotoCategories(page, e2eSession);
   await searchFor(page, name);

   const row = page.getByRole("row").filter({ hasText: name });
   await expect(row.getByRole("button", { name: "Arquivar" })).toHaveCount(0);
   await expect(row.getByRole("button", { name: "Excluir" })).toBeVisible();
});

test("exclusão em massa inclui categoria padrão", async ({
   page,
   e2eSession,
   defaultCategoryIds,
}) => {
   const name = `Padrão Bulk ${stamp()}`;
   const { team } = await seedDefault(e2eSession, defaultCategoryIds, name);

   await gotoCategories(page, e2eSession);
   await searchFor(page, name);

   const row = page.getByRole("row").filter({ hasText: name });
   await row.getByRole("checkbox").check();

   const toolbar = page.locator("[data-selection-toolbar]");
   await expect(toolbar).toBeVisible();
   await toolbar.getByRole("button", { name: "Excluir" }).click();

   const dialog = page.getByRole("alertdialog");
   await expect(dialog).toBeVisible();
   await dialog.getByRole("button", { name: "Excluir" }).click();

   await expect
      .poll(async () => {
         const remaining = await findCategoryByName(team.id, name);
         return remaining?.id ?? null;
      })
      .toBeNull();
   defaultCategoryIds.length = 0;
});
