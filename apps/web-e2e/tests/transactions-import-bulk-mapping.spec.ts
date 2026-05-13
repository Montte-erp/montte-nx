import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   findBankAccountByName,
   findTeamByOrgAndSlug,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const createdAccountIds: string[] = [];

const UUID_RE =
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
   await page.getByPlaceholder("Buscar conta por nome...").fill(name);
   await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
   const account = await findBankAccountByName(team.id, name);
   if (account) createdAccountIds.push(account.id);
}

async function uploadCsv(page: Page, csv: string) {
   await page.getByRole("button", { name: "Importar dados" }).click();
   await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
         name: "lancamentos.csv",
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
   for (const id of createdAccountIds.splice(0)) {
      await deleteBankAccountById(team.id, id);
   }
});

test("MON-982: bulk action na grade de importação exibe nome, não ID, na coluna alvo", async ({
   page,
   e2eSession,
}) => {
   const s = stamp();
   const accountName = `MON982 Conta ${s}`;
   const txA = `MON982 Lan A ${s}`;
   const txB = `MON982 Lan B ${s}`;

   await ensureBankAccount(page, e2eSession, accountName);
   await gotoTransactions(page, e2eSession);

   const csv = `Nome,Data,Valor,Tipo\n${txA},01/01/2026,100.00,Despesa\n${txB},02/01/2026,200.00,Receita\n`;
   await uploadCsv(page, csv);

   const rowA = page.getByRole("row").filter({ hasText: txA });
   const rowB = page.getByRole("row").filter({ hasText: txB });
   await expect(rowA).toBeVisible();
   await expect(rowB).toBeVisible();

   await rowA.getByLabel("Selecionar linha").click();
   await rowB.getByLabel("Selecionar linha").click();

   // custom bulk button "Conta" — deve gravar nome
   await page.getByRole("button", { name: "Conta", exact: true }).click();
   await page.getByRole("option", { name: accountName }).click();

   for (const row of [rowA, rowB]) {
      const text = (await row.textContent()) ?? "";
      expect(text, "Conta cell mostrar nome após bulk, não UUID").toContain(
         accountName,
      );
      const uuids = text.match(UUID_RE);
      expect(uuids, "Cell não deve mostrar UUID puro").toBeNull();
   }
});

test("MON-982: bulk action via toolbar genérica (Trocar conta) também exibe nome", async ({
   page,
   e2eSession,
}) => {
   const s = stamp();
   const accountName = `MON982 Generic ${s}`;
   const txA = `MON982 Gen A ${s}`;

   await ensureBankAccount(page, e2eSession, accountName);
   await gotoTransactions(page, e2eSession);

   const csv = `Nome,Data,Valor,Tipo\n${txA},01/01/2026,100.00,Despesa\n`;
   await uploadCsv(page, csv);

   const rowA = page.getByRole("row").filter({ hasText: txA });
   await expect(rowA).toBeVisible();
   await rowA.getByLabel("Selecionar linha").click();

   await page.getByRole("button", { name: "Trocar conta" }).click();
   await page.getByRole("option", { name: accountName }).click();

   const text = (await rowA.textContent()) ?? "";
   expect(
      text,
      "Conta cell mostrar nome após bulk via toolbar genérica",
   ).toContain(accountName);
   const uuids = text.match(UUID_RE);
   expect(uuids, "Cell não deve mostrar UUID puro").toBeNull();
});

test("MON-982: colunas obrigatórias sem mapeamento têm destaque visual", async ({
   page,
   e2eSession,
}) => {
   await gotoTransactions(page, e2eSession);

   // CSV sem colunas obrigatórias (Data, Tipo, Valor, Conta)
   const csv = `Nome\nLan sem obrigatorios\n`;
   await uploadCsv(page, csv);

   // headers obrigatórios devem mostrar "Não mapeado *" com classe destrutiva
   const naoMapeado = page.getByText("Não mapeado *", { exact: false }).first();
   await expect(naoMapeado).toBeVisible();
   await expect(naoMapeado).toHaveClass(/destructive/);
});

test("MON-982: mesma coluna do arquivo não pode ser mapeada para duas colunas", async ({
   page,
   e2eSession,
}) => {
   await gotoTransactions(page, e2eSession);

   const csv = `Nome,Data,Valor,Tipo\nLan X,01/01/2026,100.00,Despesa\n`;
   await uploadCsv(page, csv);

   // mapeia coluna "Vencimento" também para o header "Data"
   await page
      .getByRole("button", { name: /Vencimento|Não mapeado/i })
      .nth(0)
      .click();
   await page.getByRole("option", { name: "Data", exact: true }).click();

   // bug: ambos "Data" e "Vencimento" estão mapeados pro header "Data"
   // espera: validação visual ou bloqueio impedindo duplicidade
   const dataHeaders = page.locator("text=/^Data$/");
   await expect(
      dataHeaders,
      "Header 'Data' não deve aparecer como mapeamento em duas colunas",
   ).toHaveCount(1);
});
