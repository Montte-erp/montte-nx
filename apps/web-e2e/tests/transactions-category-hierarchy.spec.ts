import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   deleteCategoryById,
   findBankAccountByName,
   findTeamByOrgAndSlug,
   insertCategory,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const createdAccountIds: string[] = [];
const createdCategoryIds: string[] = [];

async function gotoTransactions(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/transactions`);
   await expect(
      page.getByRole("heading", { name: "Lançamentos" }),
   ).toBeVisible();
}

async function ensureBankAccount(
   page: Page,
   session: E2ESession,
   name: string,
) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) throw new Error("team not found");
   const existing = await findBankAccountByName(team.id, name);
   if (existing) {
      createdAccountIds.push(existing.id);
      return;
   }
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/bank-accounts`);
   await expect(
      page.getByRole("heading", { name: "Contas Bancárias" }),
   ).toBeVisible();
   await page.getByRole("button", { name: "Nova Conta" }).click();
   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Nome").fill(name);
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Caixa Físico" }).click();
   await sheet.getByRole("button", { name: "Criar conta" }).click();
   const created = await findBankAccountByName(team.id, name);
   if (created) createdAccountIds.push(created.id);
}

test.afterEach(async ({ e2eSession }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdCategoryIds.splice(0)) {
      await deleteCategoryById(team.id, id);
   }
   for (const id of createdAccountIds.splice(0)) {
      await deleteBankAccountById(team.id, id);
   }
});

test("category picker exibe hierarquia pai/filho respeitando tipo", async ({
   page,
   e2eSession,
}) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) throw new Error("team not found");

   const suffix = stamp();
   const expenseParent = await insertCategory(team.id, {
      name: `Despesa Pai ${suffix}`,
      type: "expense",
   });
   const expenseChild = await insertCategory(team.id, {
      name: `Despesa Filha ${suffix}`,
      type: "expense",
      parentId: expenseParent.id,
   });
   const incomeParent = await insertCategory(team.id, {
      name: `Receita Pai ${suffix}`,
      type: "income",
   });
   createdCategoryIds.push(expenseChild.id, expenseParent.id, incomeParent.id);

   const accountName = `Caixa Hierarquia ${suffix}`;
   await ensureBankAccount(page, e2eSession, accountName);

   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();
   const sheet = page.getByRole("dialog");

   // Default = Despesa. Abre picker.
   await sheet.getByRole("combobox", { name: "Categoria" }).click();
   const listbox = page.getByRole("listbox");

   // Receita Pai não aparece (tipo errado).
   await expect(
      listbox.getByRole("option", { name: incomeParent.name }),
   ).toHaveCount(0);

   // Despesa Pai visível; filha escondida até expandir.
   await expect(
      listbox.getByRole("option", { name: expenseParent.name }),
   ).toBeVisible();
   await expect(
      listbox.getByRole("option", { name: expenseChild.name }),
   ).toHaveCount(0);

   // Expandir pai revela filha.
   await listbox
      .getByRole("option", { name: expenseParent.name })
      .getByRole("button", { name: "Expandir" })
      .click();
   await expect(
      listbox.getByRole("option", { name: expenseChild.name }),
   ).toBeVisible();

   // Seleciona filha → label mostra "Pai / Filha".
   await listbox.getByRole("option", { name: expenseChild.name }).click();
   await expect(
      sheet.getByRole("combobox", { name: "Categoria" }),
   ).toContainText(`${expenseParent.name} / ${expenseChild.name}`);

   // Troca tipo → categoria reseta e lista mostra apenas receita.
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Receita" }).click();
   await expect(
      sheet.getByRole("combobox", { name: "Categoria" }),
   ).toContainText("Selecionar categoria...");

   await sheet.getByRole("combobox", { name: "Categoria" }).click();
   await expect(
      listbox.getByRole("option", { name: incomeParent.name }),
   ).toBeVisible();
   await expect(
      listbox.getByRole("option", { name: expenseParent.name }),
   ).toHaveCount(0);
});
