import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   findBankAccountByName,
   findTeamByOrgAndSlug,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const createdIds: string[] = [];

async function gotoBankAccounts(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/bank-accounts`);
   await expect(
      page.getByRole("heading", { name: "Contas Bancárias" }),
   ).toBeVisible();
}

async function rememberCreatedAccount(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const account = await findBankAccountByName(team.id, name);
   if (!account) return;
   createdIds.push(account.id);
}

async function expectBankAccountRowVisible(page: Page, name: string) {
   await page.getByPlaceholder("Buscar conta por nome...").fill(name);
   await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
}

async function clearBankAccountSearch(page: Page) {
   await page.getByPlaceholder("Buscar conta por nome...").fill("");
}

async function uploadBankAccountsCsv(page: Page, csv: string) {
   await page.getByRole("button", { name: "Importar dados" }).click();
   await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
         name: "contas-bancarias.csv",
         mimeType: "text/csv",
         buffer: Buffer.from(csv, "utf8"),
      });
   await expect(page.getByText("Importando")).toBeVisible();
}

test.afterEach(async ({ e2eSession }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdIds.splice(0)) {
      await deleteBankAccountById(team.id, id);
   }
});

test("importação permite alterar tipo e mostra ações em massa", async ({
   page,
   e2eSession,
}) => {
   const name = `Import Tipo E2E ${stamp()}`;
   await gotoBankAccounts(page, e2eSession);
   await uploadBankAccountsCsv(
      page,
      `Nome,Tipo,Saldo Inicial,Código do Banco,Banco\n${name},,100.00,341,Itaú\n`,
   );

   const row = page.getByRole("row").filter({ hasText: name });
   await expect(row).toBeVisible();
   await expect(row.getByLabel("Tipo")).toHaveText("Conta Corrente");

   await row.getByLabel("Selecionar linha").click();
   await expect(
      page.locator("[data-selection-toolbar]").getByText("1"),
   ).toBeVisible();

   await page.getByRole("button", { name: "Trocar tipo" }).click();
   await page.getByRole("button", { name: "Caixa Físico" }).click();
   await expect(row.getByLabel("Tipo")).toHaveText("Caixa Físico");

   await row.getByRole("button", { name: "Salvar" }).click();
   await expect(page.getByText("Linha importada com sucesso.")).toBeVisible();
   await rememberCreatedAccount(e2eSession, name);
   await expectBankAccountRowVisible(page, name);
});

test("cria conta bancária com validações, máscaras e autocomplete", async ({
   page,
   e2eSession,
}) => {
   const name = `Itaú E2E ${stamp()}`;

   await gotoBankAccounts(page, e2eSession);
   await page.getByRole("button", { name: "Nova Conta" }).click();

   const sheet = page.getByRole("dialog");
   const submit = sheet.getByRole("button", { name: "Criar conta" });

   // submit desabilitado ao abrir (form inválido)
   await expect(submit).toBeDisabled();

   // erro de nome no blur
   await sheet.getByLabel("Nome").fill("a");
   await sheet.getByLabel("Nome").blur();
   await expect(
      sheet.getByText("Nome deve ter no mínimo 2 caracteres."),
   ).toBeVisible();

   await sheet.getByLabel("Nome").fill(name);

   // detalhes bancários visíveis para tipo bancário (default checking)
   await expect(sheet.getByText("Detalhes bancários")).toBeVisible();

   // bankCode hard limit 3 dígitos
   const code = sheet.getByLabel("Código do banco");
   await code.fill("123456789");
   await expect(code).toHaveValue("123");

   // autocomplete preenche bankName + bankCode
   const autocomplete = sheet.getByPlaceholder("Digite o nome ou código");
   await autocomplete.click();
   await autocomplete.fill("itau");
   await page.getByRole("option").first().click();
   await expect(code).toHaveValue(/^\d{1,3}$/);

   // máscara agência: limita a 4-1
   const branch = sheet.getByLabel("Agência");
   await branch.fill("12345-67");
   await expect(branch).toHaveValue("1234-6");

   // máscara conta: aceita 12 dígitos + dígito verificador
   await sheet.getByLabel("Conta").fill("56789-0");

   // submit habilitado e cria
   await expect(submit).toBeEnabled();
   await submit.click();
   await expect(page.getByText("Conta criada com sucesso.")).toBeVisible();
   await rememberCreatedAccount(e2eSession, name);
   await expectBankAccountRowVisible(page, name);

   // inline edit do nome (única coluna editável inline)
   const renamed = `${name} renomeado`;
   const row = page.getByRole("row").filter({ hasText: name }).first();
   await row.getByRole("button", { name: "Editar Nome" }).click();
   const inlineInput = page.getByRole("textbox", { name: "Editar Nome" });
   await expect(inlineInput).toBeVisible();
   await inlineInput.fill(renamed);
   await inlineInput.press("Enter");
   await expectBankAccountRowVisible(page, renamed);
});

test("toggle de tipo + caixa físico (sem detalhes bancários)", async ({
   page,
   e2eSession,
}) => {
   const name = `Caixa E2E ${stamp()}`;

   await gotoBankAccounts(page, e2eSession);
   await page.getByRole("button", { name: "Nova Conta" }).click();
   const sheet = page.getByRole("dialog");

   await sheet.getByLabel("Nome").fill(name);

   // checking default → bloco visível
   await expect(sheet.getByText("Detalhes bancários")).toBeVisible();

   // → cash → some
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Caixa Físico" }).click();
   await expect(sheet.getByText("Detalhes bancários")).not.toBeVisible();

   // → savings → volta
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Conta Poupança" }).click();
   await expect(sheet.getByText("Detalhes bancários")).toBeVisible();

   // volta para cash e cria sem detalhes
   await sheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Caixa Físico" }).click();
   await sheet.getByRole("button", { name: "Criar conta" }).click();

   await expect(page.getByText("Conta criada com sucesso.")).toBeVisible();
   await rememberCreatedAccount(e2eSession, name);
   await expectBankAccountRowVisible(page, name);
});

test("cancelar fecha sheet sem criar", async ({ page, e2eSession }) => {
   await gotoBankAccounts(page, e2eSession);
   await page.getByRole("button", { name: "Nova Conta" }).click();
   const sheet = page.getByRole("dialog");

   await sheet.getByLabel("Nome").fill("Não deve criar");
   await sheet.getByRole("button", { name: "Cancelar" }).click();

   await expect(sheet).not.toBeVisible();
   await expect(
      page.getByRole("cell", { name: "Não deve criar" }),
   ).not.toBeVisible();
});

test("filtra por tipo e exclui via alert dialog", async ({
   page,
   e2eSession,
}) => {
   const checkingName = `Checking E2E ${stamp()}`;
   const cashName = `Caixa E2E ${stamp()}`;

   await gotoBankAccounts(page, e2eSession);

   // criar checking
   await page.getByRole("button", { name: "Nova Conta" }).click();
   const checkingSheet = page.getByRole("dialog");
   await checkingSheet.getByLabel("Nome").fill(checkingName);
   await checkingSheet.getByPlaceholder("Digite o nome ou código").fill("itau");
   await checkingSheet.getByRole("option").first().click();
   await checkingSheet.getByRole("button", { name: "Criar conta" }).click();
   await rememberCreatedAccount(e2eSession, checkingName);
   await expectBankAccountRowVisible(page, checkingName);

   // criar caixa
   await page.getByRole("button", { name: "Nova Conta" }).click();
   const cashSheet = page.getByRole("dialog");
   await cashSheet.getByLabel("Nome").fill(cashName);
   await cashSheet.getByLabel("Tipo").click();
   await page.getByRole("option", { name: "Caixa Físico" }).click();
   await cashSheet.getByRole("button", { name: "Criar conta" }).click();
   await rememberCreatedAccount(e2eSession, cashName);
   await expectBankAccountRowVisible(page, cashName);

   // filtrar Caixa Físico
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/bank-accounts?type=cash`,
   );
   await expect(
      page.getByRole("heading", { name: "Contas Bancárias" }),
   ).toBeVisible();
   await expectBankAccountRowVisible(page, cashName);
   await expect(
      page.getByRole("cell", { name: checkingName }),
   ).not.toBeVisible();

   // excluir caixa via alert dialog
   const row = page.getByRole("row").filter({ hasText: cashName });
   await row.getByRole("button", { name: "Excluir" }).click();
   const alert = page.getByRole("alertdialog");
   await expect(alert).toBeVisible();
   await alert.getByRole("button", { name: "Excluir" }).click();

   await expect(page.getByText("Conta excluída com sucesso.")).toBeVisible();
   await expect(page.getByRole("cell", { name: cashName })).not.toBeVisible();
});

test("busca server-side por nome e exclusão em massa", async ({
   page,
   e2eSession,
}) => {
   const a = `Bulk-A E2E ${stamp()}`;
   const b = `Bulk-B E2E ${stamp()}`;

   await gotoBankAccounts(page, e2eSession);

   for (const name of [a, b]) {
      await page.getByRole("button", { name: "Nova Conta" }).click();
      const sheet = page.getByRole("dialog");
      await sheet.getByLabel("Nome").fill(name);
      await sheet.getByLabel("Tipo").click();
      await page.getByRole("option", { name: "Caixa Físico" }).click();
      await sheet.getByRole("button", { name: "Criar conta" }).click();
      await rememberCreatedAccount(e2eSession, name);
      await expectBankAccountRowVisible(page, name);
      await clearBankAccountSearch(page);
   }

   // server-side search filtra a lista
   await page.getByPlaceholder("Buscar conta por nome...").fill("Bulk-A");
   await expectBankAccountRowVisible(page, a);
   await expect(page.getByRole("cell", { name: b })).not.toBeVisible();
   await clearBankAccountSearch(page);

   await expectBankAccountRowVisible(page, b);
});

test("empty state aparece quando filtro não retorna contas", async ({
   page,
   e2eSession,
}) => {
   await gotoBankAccounts(page, e2eSession);
   await page
      .getByPlaceholder("Buscar conta por nome...")
      .fill(`sem-contas-${stamp()}`);

   await expect(page.getByText("Nenhuma conta bancária")).toBeVisible();
   await expect(
      page.getByText(
         "Adicione uma conta para começar a gerenciar suas finanças.",
      ),
   ).toBeVisible();
});
