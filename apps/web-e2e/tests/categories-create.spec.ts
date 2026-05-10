import type { Page } from "@playwright/test";
import { expect, test as base, type E2ESession } from "../fixtures";
import {
   deleteCategoryById,
   findCategoryByName,
   findTeamByOrgAndSlug,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const test = base.extend<{ createdCategoryIds: string[] }>({
   createdCategoryIds: async ({}, use) => {
      await use([]);
   },
});

async function gotoCategories(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/categories`);
   await expect(
      page.getByRole("heading", { name: "Categorias" }),
   ).toBeVisible();
}

async function rememberCreatedCategory(
   session: E2ESession,
   name: string,
   createdCategoryIds: string[],
) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const cat = await findCategoryByName(team.id, name);
   if (!cat) return;
   createdCategoryIds.push(cat.id);
}

async function expectCategoryRowVisible(page: Page, name: string) {
   await page.getByRole("textbox", { name: "Buscar categorias..." }).fill(name);
   await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
}

test.afterEach(async ({ e2eSession, createdCategoryIds }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdCategoryIds.splice(0)) {
      await deleteCategoryById(team.id, id);
   }
});

test("seletor de tipo exibe Transferência", async ({ page, e2eSession }) => {
   await gotoCategories(page, e2eSession);
   await page.getByRole("button", { name: "Nova Categoria" }).click();

   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Tipo").click();

   await expect(page.getByRole("option", { name: "Receita" })).toBeVisible();
   await expect(page.getByRole("option", { name: "Despesa" })).toBeVisible();
   await expect(
      page.getByRole("option", { name: "Transferência" }),
   ).toBeVisible();
});

test("cria categoria do tipo Transferência", async ({
   page,
   e2eSession,
   createdCategoryIds,
}) => {
   const name = `Transferência E2E ${stamp()}`;

   await gotoCategories(page, e2eSession);
   await page.getByRole("button", { name: "Nova Categoria" }).click();

   const sheet = page.getByRole("dialog");

   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Transferência" }).click();

   await sheet.getByLabel("Nome").fill(name);

   const submit = sheet.getByRole("button", { name: "Criar categoria" });
   await expect(submit).toBeEnabled();
   await submit.click();

   await expect(page.getByText("Categoria criada com sucesso.")).toBeVisible();
   await rememberCreatedCategory(e2eSession, name, createdCategoryIds);
   await expectCategoryRowVisible(page, name);
});

test("cria categoria vinculada a uma categoria pai", async ({
   page,
   e2eSession,
   createdCategoryIds,
}) => {
   const parentName = `Pai E2E ${stamp()}`;
   const childName = `Filha E2E ${stamp()}`;

   await gotoCategories(page, e2eSession);
   await page.getByRole("button", { name: "Nova Categoria" }).click();

   let sheet = page.getByRole("dialog");
   await sheet.getByRole("radio", { name: "Ícone Carteira" }).click();
   await sheet.getByLabel("Nome").fill(parentName);
   await sheet.getByRole("button", { name: "Criar categoria" }).click();
   await expect(page.getByText("Categoria criada com sucesso.")).toBeVisible();
   await rememberCreatedCategory(e2eSession, parentName, createdCategoryIds);
   await expectCategoryRowVisible(page, parentName);

   await page.getByRole("button", { name: "Nova Categoria" }).click();
   sheet = page.getByRole("dialog");
   await sheet.getByLabel("Categoria pai").click();
   await page.getByRole("option", { name: parentName }).click();
   await expect(sheet.getByText("Ícone")).not.toBeVisible();
   await sheet.getByLabel("Nome").fill(childName);
   await sheet.getByRole("button", { name: "Criar categoria" }).click();
   await expect(page.getByText("Categoria criada com sucesso.")).toBeVisible();
   await rememberCreatedCategory(e2eSession, childName, createdCategoryIds);

   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;
   const parent = await findCategoryByName(team.id, parentName);
   const child = await findCategoryByName(team.id, childName);
   expect(parent).not.toBeNull();
   expect(parent?.icon).toBe("wallet");
   expect(child?.parentId).toBe(parent?.id);
   expect(child?.icon).toBeNull();

   await page
      .getByRole("textbox", { name: "Buscar categorias..." })
      .fill(childName);
   await expect(
      page
         .getByRole("row")
         .filter({ hasText: childName })
         .filter({ hasText: parentName }),
   ).toBeVisible();
});

test("permite escolher ícone na categoria pai e subcategoria herda sem persistir ícone", async ({
   page,
   e2eSession,
   createdCategoryIds,
}) => {
   const parentName = `Pai Ícone E2E ${stamp()}`;
   const childName = `Filha Ícone E2E ${stamp()}`;

   await gotoCategories(page, e2eSession);
   await page.getByRole("button", { name: "Nova Categoria" }).click();

   let sheet = page.getByRole("dialog");
   await expect(sheet.getByRole("radiogroup", { name: "Ícone" })).toBeVisible();
   await sheet.getByRole("radio", { name: "Ícone Tecnologia" }).click();
   await sheet.getByLabel("Nome").fill(parentName);
   await sheet.getByRole("button", { name: "Criar categoria" }).click();
   await expect(page.getByText("Categoria criada com sucesso.")).toBeVisible();
   await rememberCreatedCategory(e2eSession, parentName, createdCategoryIds);

   await page.getByRole("button", { name: "Nova Categoria" }).click();
   sheet = page.getByRole("dialog");
   await sheet.getByLabel("Categoria pai").click();
   await page.getByRole("option", { name: parentName }).click();
   await expect(
      sheet.getByRole("radiogroup", { name: "Ícone" }),
   ).not.toBeVisible();
   await sheet.getByLabel("Nome").fill(childName);
   await sheet.getByRole("button", { name: "Criar categoria" }).click();
   await expect(page.getByText("Categoria criada com sucesso.")).toBeVisible();
   await rememberCreatedCategory(e2eSession, childName, createdCategoryIds);

   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;
   const parent = await findCategoryByName(team.id, parentName);
   const child = await findCategoryByName(team.id, childName);
   expect(parent?.icon).toBe("smartphone");
   expect(child?.parentId).toBe(parent?.id);
   expect(child?.icon).toBeNull();
});

test("cria categoria sem categoria pai", async ({
   page,
   e2eSession,
   createdCategoryIds,
}) => {
   const name = `Raiz E2E ${stamp()}`;

   await gotoCategories(page, e2eSession);
   await page.getByRole("button", { name: "Nova Categoria" }).click();

   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Categoria pai").click();
   await page.getByRole("option", { name: "Sem categoria pai" }).click();
   await sheet.getByLabel("Nome").fill(name);
   await sheet.getByRole("button", { name: "Criar categoria" }).click();
   await expect(page.getByText("Categoria criada com sucesso.")).toBeVisible();
   await rememberCreatedCategory(e2eSession, name, createdCategoryIds);

   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;
   const category = await findCategoryByName(team.id, name);
   expect(category?.parentId).toBeNull();
});

test("filtro Somente transferências lista categoria criada", async ({
   page,
   e2eSession,
   createdCategoryIds,
}) => {
   const name = `Categoria Transfer ${stamp()}`;

   await gotoCategories(page, e2eSession);
   await page.getByRole("button", { name: "Nova Categoria" }).click();

   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Transferência" }).click();
   await sheet.getByLabel("Nome").fill(name);
   await sheet.getByRole("button", { name: "Criar categoria" }).click();
   await expect(page.getByText("Categoria criada com sucesso.")).toBeVisible();
   await rememberCreatedCategory(e2eSession, name, createdCategoryIds);

   await page.getByRole("button", { name: "Filtros" }).click();
   const menu = page.getByRole("menu");
   await expect(menu).toBeVisible();
   await menu.getByRole("menuitem", { name: /Somente transferências/ }).click();
   await page.mouse.click(10, 10);

   await expectCategoryRowVisible(page, name);
});

test("validação: nome curto bloqueia submit", async ({ page, e2eSession }) => {
   await gotoCategories(page, e2eSession);
   await page.getByRole("button", { name: "Nova Categoria" }).click();

   const sheet = page.getByRole("dialog");
   const submit = sheet.getByRole("button", { name: "Criar categoria" });

   await expect(submit).toBeDisabled();

   await sheet.getByLabel("Nome").fill("a");
   await sheet.getByLabel("Nome").blur();
   await expect(
      sheet.getByText("Nome deve ter no mínimo 2 caracteres."),
   ).toBeVisible();
   await expect(submit).toBeDisabled();
});

test("cancelar fecha sheet sem criar", async ({ page, e2eSession }) => {
   await gotoCategories(page, e2eSession);
   await page.getByRole("button", { name: "Nova Categoria" }).click();
   const sheet = page.getByRole("dialog");

   await sheet.getByLabel("Nome").fill("Não deve criar");
   await sheet.getByRole("button", { name: "Cancelar" }).click();

   await expect(sheet).not.toBeVisible();
   await expect(
      page.getByRole("row").filter({ hasText: "Não deve criar" }),
   ).not.toBeVisible();
});
