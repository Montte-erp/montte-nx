import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   deleteTransactionById,
   findBankAccountByName,
   findTeamByOrgAndSlug,
   findTransactionByName,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const createdTxIds: string[] = [];
const createdAccountIds: string[] = [];

async function gotoTransactions(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/transactions`);
   await expect(
      page.getByRole("heading", { name: "Lançamentos" }),
   ).toBeVisible();
}

async function gotoBankAccounts(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/bank-accounts`);
   await expect(
      page.getByRole("heading", { name: "Contas Bancárias" }),
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

async function expectBankAccountRowVisible(page: Page, name: string) {
   await page.getByPlaceholder("Buscar conta por nome...").fill(name);
   await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
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

async function ensureBankAccount(
   page: Page,
   session: E2ESession,
   name: string,
) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const existing = await findBankAccountByName(team.id, name);
   if (existing) {
      createdAccountIds.push(existing.id);
      return;
   }
   await gotoBankAccounts(page, session);
   await page.getByRole("button", { name: "Nova Conta" }).click();
   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Nome").fill(name);
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Caixa Físico" }).click();
   await sheet.getByRole("button", { name: "Criar conta" }).click();
   await rememberCreatedAccount(session, name);
   await expectBankAccountRowVisible(page, name);
}

test.afterEach(async ({ e2eSession }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdTxIds.splice(0)) {
      await deleteTransactionById(team.id, id);
   }
   for (const id of createdAccountIds.splice(0)) {
      await deleteBankAccountById(team.id, id);
   }
});

test("cria receita com conta bancária", async ({ page, e2eSession }) => {
   const accountName = `Caixa Receita ${stamp()}`;
   const txName = `Receita E2E ${stamp()}`;

   await ensureBankAccount(page, e2eSession, accountName);
   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();

   const sheet = page.getByRole("dialog");
   const submit = sheet.getByRole("button", { name: "Criar lançamento" });

   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Receita" }).click();

   await sheet.getByLabel("Nome").fill(txName);
   await sheet.getByLabel("Valor").fill("123,45");

   await selectComboboxOption(page, "Conta bancária", accountName);

   await expect(submit).toBeEnabled();
   await submit.click();
   await expect(page.getByText("Lançamento criado com sucesso.")).toBeVisible();
   await rememberCreatedTransaction(e2eSession, txName);
   await expectTransactionRowVisible(e2eSession, txName);
});

test("cria despesa com conta bancária", async ({ page, e2eSession }) => {
   const accountName = `Caixa Despesa ${stamp()}`;
   const txName = `Despesa E2E ${stamp()}`;

   await ensureBankAccount(page, e2eSession, accountName);
   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Novo Lançamento" }).click();

   const sheet = page.getByRole("dialog");

   // default type = Despesa
   await sheet.getByLabel("Nome").fill(txName);
   await sheet.getByLabel("Valor").fill("99,90");

   await selectComboboxOption(page, "Conta bancária", accountName);

   await sheet.getByRole("button", { name: "Criar lançamento" }).click();
   await expect(page.getByText("Lançamento criado com sucesso.")).toBeVisible();
   await rememberCreatedTransaction(e2eSession, txName);
   await expectTransactionRowVisible(e2eSession, txName);
});

test("cria transferência entre contas", async ({ page, e2eSession }) => {
   const fromName = `Origem ${stamp()}`;
   const toName = `Destino ${stamp()}`;
   const txName = `Transferência E2E ${stamp()}`;

   await ensureBankAccount(page, e2eSession, fromName);
   await ensureBankAccount(page, e2eSession, toName);

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
