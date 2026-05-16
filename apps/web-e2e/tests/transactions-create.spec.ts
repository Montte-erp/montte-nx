import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   deleteCategoryById,
   deleteTransactionRecurrenceById,
   deleteTransactionById,
   findBankAccountByName,
   findTransactionRecurrenceById,
   findTeamByOrgAndSlug,
   findTransactionByName,
   findTransactionsByInstallmentGroupId,
   findTransactionsByName,
   insertBankAccount,
   insertCategory,
} from "../helpers/db";

test.describe.configure({ mode: "serial" });

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const createdTxIds: string[] = [];
const createdAccountIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdRecurrenceIds: string[] = [];

async function gotoTransactions(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/transactions`);
   await expect(
      page.getByRole("heading", { name: "Lançamentos" }),
   ).toBeVisible();
}

async function rememberCreatedTransaction(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const tx = await findTransactionByName(team.id, name);
   if (!tx) return;
   createdTxIds.push(tx.id);
}

async function rememberCreatedAccount(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const account = await findBankAccountByName(team.id, name);
   if (!account) return;
   createdAccountIds.push(account.id);
}

async function expectTransactionRowVisible(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   expect(team).not.toBeNull();
   if (!team) return;
   const transaction = await findTransactionByName(team.id, name);
   expect(transaction).not.toBeNull();
}

async function selectComboboxOption(
   page: Page,
   label: string,
   optionName: string,
) {
   await page.getByRole("combobox", { name: label }).click();
   await page.getByPlaceholder("Buscar conta...").fill(optionName);
   await page.getByRole("option", { name: optionName }).click();
}

async function selectCategoryOption(
   page: Page,
   label: string,
   optionName: string,
) {
   await page.getByRole("combobox", { name: label }).click();
   await page.getByPlaceholder("Buscar categoria...").fill(optionName);
   await page.getByRole("option", { name: optionName }).click();
}

async function ensureBankAccount(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const existing = await findBankAccountByName(team.id, name);
   if (existing) {
      createdAccountIds.push(existing.id);
      return;
   }
   await insertBankAccount(team.id, name);
   await rememberCreatedAccount(session, name);
}

test.afterEach(async ({ e2eSession }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdRecurrenceIds.splice(0)) {
      await deleteTransactionRecurrenceById(team.id, id);
   }
   for (const id of createdTxIds.splice(0)) {
      await deleteTransactionById(team.id, id);
   }
   for (const id of createdCategoryIds.splice(0)) {
      await deleteCategoryById(team.id, id);
   }
   for (const id of createdAccountIds.splice(0)) {
      await deleteBankAccountById(team.id, id);
   }
});

test("cria receita com conta bancária", async ({ page, e2eSession }) => {
   const accountName = `Caixa Receita ${stamp()}`;
   const categoryName = `Categoria Receita ${stamp()}`;
   const txName = `Receita E2E ${stamp()}`;
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;
   const category = await insertCategory(team.id, {
      name: categoryName,
      type: "income",
   });
   createdCategoryIds.push(category.id);

   await ensureBankAccount(e2eSession, accountName);
   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();

   const sheet = page.getByRole("dialog");
   const submit = sheet.getByRole("button", { name: "Criar lançamento" });

   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Receita" }).click();

   await sheet.getByLabel("Nome").fill(txName);
   await sheet.getByLabel("Valor").fill("123,45");

   await selectComboboxOption(page, "Conta bancária", accountName);
   await selectCategoryOption(page, "Categoria", categoryName);

   await expect(submit).toBeEnabled();
   await submit.click();
   await expect(page.getByText("Lançamento criado com sucesso.")).toBeVisible();
   await rememberCreatedTransaction(e2eSession, txName);
   await expectTransactionRowVisible(e2eSession, txName);
});

test("cria despesa com conta bancária", async ({ page, e2eSession }) => {
   const accountName = `Caixa Despesa ${stamp()}`;
   const categoryName = `Categoria Despesa ${stamp()}`;
   const txName = `Despesa E2E ${stamp()}`;
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;
   const category = await insertCategory(team.id, {
      name: categoryName,
      type: "expense",
   });
   createdCategoryIds.push(category.id);

   await ensureBankAccount(e2eSession, accountName);
   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();

   const sheet = page.getByRole("dialog");

   // default type = Despesa
   await sheet.getByLabel("Nome").fill(txName);
   await sheet.getByLabel("Valor").fill("99,90");

   await selectComboboxOption(page, "Conta bancária", accountName);
   await selectCategoryOption(page, "Categoria", categoryName);

   await sheet.getByRole("button", { name: "Criar lançamento" }).click();
   await expect(page.getByText("Lançamento criado com sucesso.")).toBeVisible();
   await rememberCreatedTransaction(e2eSession, txName);
   await expectTransactionRowVisible(e2eSession, txName);
});

test("cria despesa parcelada", async ({ page, e2eSession }) => {
   const accountName = `Caixa Parcelado ${stamp()}`;
   const categoryName = `Categoria Parcelado ${stamp()}`;
   const txName = `Parcelado E2E ${stamp()}`;
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;
   const category = await insertCategory(team.id, {
      name: categoryName,
      type: "expense",
   });
   createdCategoryIds.push(category.id);

   await ensureBankAccount(e2eSession, accountName);
   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();

   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Nome").fill(txName);
   await sheet.getByLabel("Valor").fill("120,00");
   await selectComboboxOption(page, "Conta bancária", accountName);
   await selectCategoryOption(page, "Categoria", categoryName);
   await sheet.getByLabel("Parcelar lançamento").check();
   await sheet.getByLabel("Número de parcelas").fill("3");

   await sheet.getByRole("button", { name: "Criar lançamento" }).click();
   await expect(page.getByText("Lançamento criado com sucesso.")).toBeVisible();

   await expect
      .poll(
         async () =>
            (await findTransactionByName(team.id, `${txName} (1/3)`))?.id ??
            null,
      )
      .not.toBeNull();
   const firstInstallment = await findTransactionByName(
      team.id,
      `${txName} (1/3)`,
   );
   if (!firstInstallment?.installmentGroupId) {
      throw new Error("Parcelamento não criou grupo de parcelas.");
   }
   const rows = await findTransactionsByInstallmentGroupId(
      team.id,
      firstInstallment.installmentGroupId,
   );
   createdTxIds.push(...rows.map((row) => row.id));

   expect(rows).toHaveLength(3);
   expect(rows.map((row) => row.name)).toEqual([
      `${txName} (1/3)`,
      `${txName} (2/3)`,
      `${txName} (3/3)`,
   ]);
   expect(rows.map((row) => row.amount)).toEqual(["40.00", "40.00", "40.00"]);
   expect(rows.map((row) => row.installmentNumber)).toEqual([1, 2, 3]);
   expect(rows.map((row) => row.installmentCount)).toEqual([3, 3, 3]);
});

test("cria despesa recorrente", async ({ page, e2eSession }) => {
   const accountName = `Caixa Recorrente ${stamp()}`;
   const categoryName = `Categoria Recorrente ${stamp()}`;
   const txName = `Recorrente E2E ${stamp()}`;
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;
   const category = await insertCategory(team.id, {
      name: categoryName,
      type: "expense",
   });
   createdCategoryIds.push(category.id);

   await ensureBankAccount(e2eSession, accountName);
   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();

   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Nome").fill(txName);
   await sheet.getByLabel("Valor").fill("80,00");
   await selectComboboxOption(page, "Conta bancária", accountName);
   await selectCategoryOption(page, "Categoria", categoryName);
   await sheet.getByLabel("Lançamento recorrente").check();
   await sheet.getByLabel("Periodicidade").click();
   await page.getByRole("option", { name: "Mensal" }).click();

   await sheet.getByRole("button", { name: "Criar lançamento" }).click();
   await expect(page.getByText("Lançamento criado com sucesso.")).toBeVisible();

   await expect
      .poll(async () => (await findTransactionsByName(team.id, txName)).length)
      .toBe(2);
   const rows = await findTransactionsByName(team.id, txName);
   const recurrenceId = rows[0]?.recurrenceId;
   expect(recurrenceId).not.toBeNull();
   if (!recurrenceId) return;
   createdRecurrenceIds.push(recurrenceId);
   createdTxIds.push(...rows.map((row) => row.id));

   expect(rows.every((row) => row.recurrenceId === recurrenceId)).toBe(true);
   expect(rows.map((row) => row.amount)).toEqual(["80.00", "80.00"]);
   expect(rows.map((row) => row.recurrenceOccurrenceNumber)).toEqual([1, 2]);

   const recurrence = await findTransactionRecurrenceById(
      team.id,
      recurrenceId,
   );
   expect(recurrence?.frequency).toBe("monthly");
   expect(recurrence?.status).toBe("active");
});

test("cria transferência entre contas", async ({ page, e2eSession }) => {
   const fromName = `Origem ${stamp()}`;
   const toName = `Destino ${stamp()}`;
   const txName = `Transferência E2E ${stamp()}`;

   await ensureBankAccount(e2eSession, fromName);
   await ensureBankAccount(e2eSession, toName);

   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();
   const sheet = page.getByRole("dialog");

   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Transferência" }).click();

   await sheet.getByLabel("Nome").fill(txName);
   await sheet.getByLabel("Valor").fill("50,00");

   await selectComboboxOption(page, "Conta de origem", fromName);

   await selectComboboxOption(page, "Conta de destino", toName);

   await sheet.getByRole("button", { name: "Criar lançamento" }).click();
   await expect(page.getByText("Lançamento criado com sucesso.")).toBeVisible();
   await rememberCreatedTransaction(e2eSession, txName);
   await expectTransactionRowVisible(e2eSession, txName);
});

test("validações de campos obrigatórios", async ({ page, e2eSession }) => {
   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();

   const sheet = page.getByRole("dialog");
   const submit = sheet.getByRole("button", { name: "Criar lançamento" });

   // submit desabilitado de cara (form inválido)
   await expect(submit).toBeDisabled();

   // nome curto → erro
   await sheet.getByLabel("Nome").fill("a");
   await sheet.getByLabel("Nome").blur();
   await expect(
      sheet.getByText("Nome deve ter no mínimo 2 caracteres."),
   ).toBeVisible();

   // valor zero → submit segue desabilitado
   await sheet.getByLabel("Nome").fill("Validação");
   await expect(submit).toBeDisabled();

   // tipo padrão sem conta → mensagem específica
   await sheet.getByLabel("Valor").fill("10,00");
   await sheet.getByRole("combobox", { name: "Conta bancária" }).focus();
   await sheet.getByRole("combobox", { name: "Conta bancária" }).blur();
   await expect(
      sheet.getByText("Despesas exigem uma conta bancária."),
   ).toBeVisible();
   await expect(submit).toBeDisabled();
});

test("cancelar fecha sheet sem criar", async ({ page, e2eSession }) => {
   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();
   const sheet = page.getByRole("dialog");

   await sheet.getByLabel("Nome").fill("Não deve criar");
   await sheet.getByRole("button", { name: "Cancelar" }).click();

   await expect(sheet).not.toBeVisible();
   await expect(
      page.getByRole("cell", { name: "Não deve criar" }),
   ).not.toBeVisible();
});
