import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   findBankAccountByName,
   findTeamByOrgAndSlug,
} from "../helpers/db";

test.describe.configure({ mode: "serial" });

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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

async function createBankAccountReturnId(
   page: Page,
   session: E2ESession,
   name: string,
): Promise<{ id: string | null; createdHere: boolean }> {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return { id: null, createdHere: false };
   const existing = await findBankAccountByName(team.id, name);
   if (existing) return { id: existing.id, createdHere: false };
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
   return { id: account?.id ?? null, createdHere: Boolean(account) };
}

async function safeDeleteBankAccount(session: E2ESession, id: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   await deleteBankAccountById(team.id, id);
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

test("MON-982: bulk via botão custom 'Conta' grava nome na grade de importação", async ({
   page,
   e2eSession,
}) => {
   const s = stamp();
   const accountName = `MON982 Conta ${s}`;
   const txA = `MON982 Lan A ${s}`;
   const txB = `MON982 Lan B ${s}`;
   const created = await createBankAccountReturnId(
      page,
      e2eSession,
      accountName,
   );
   try {
      await gotoTransactions(page, e2eSession);
      const csv = `Nome,Data,Valor,Tipo\n${txA},01/01/2026,100.00,Despesa\n${txB},02/01/2026,200.00,Receita\n`;
      await uploadCsv(page, csv);

      const rowA = page.getByRole("row").filter({ hasText: txA });
      const rowB = page.getByRole("row").filter({ hasText: txB });
      await expect(rowA).toBeVisible();
      await expect(rowB).toBeVisible();

      await rowA.getByLabel("Selecionar linha").click();
      await rowB.getByLabel("Selecionar linha").click();

      await page.getByRole("button", { name: "Conta", exact: true }).click();
      await page.getByRole("option", { name: accountName }).click();

      for (const row of [rowA, rowB]) {
         const text = (await row.textContent()) ?? "";
         expect(text, "deve conter nome").toContain(accountName);
         expect(text.match(UUID_RE), "não deve conter UUID puro").toBeNull();
      }
   } finally {
      if (created.createdHere && created.id) {
         await safeDeleteBankAccount(e2eSession, created.id);
      }
   }
});

test("MON-982: bulk via toolbar genérica 'Trocar conta' grava nome na grade de importação", async ({
   page,
   e2eSession,
}) => {
   const s = stamp();
   const accountName = `MON982 Generic ${s}`;
   const txA = `MON982 Gen A ${s}`;
   const created = await createBankAccountReturnId(
      page,
      e2eSession,
      accountName,
   );
   try {
      await gotoTransactions(page, e2eSession);
      const csv = `Nome,Data,Valor,Tipo\n${txA},01/01/2026,100.00,Despesa\n`;
      await uploadCsv(page, csv);

      const rowA = page.getByRole("row").filter({ hasText: txA });
      await expect(rowA).toBeVisible();
      await rowA.getByLabel("Selecionar linha").click();

      await page.getByRole("button", { name: "Trocar conta" }).click();
      await page.getByRole("option", { name: accountName }).click();

      const text = (await rowA.textContent()) ?? "";
      expect(text, "deve conter nome").toContain(accountName);
      expect(text.match(UUID_RE), "não deve conter UUID puro").toBeNull();
   } finally {
      if (created.createdHere && created.id) {
         await safeDeleteBankAccount(e2eSession, created.id);
      }
   }
});

test("MON-982: colunas obrigatórias sem mapeamento expõem testid unmapped-required", async ({
   page,
   e2eSession,
}) => {
   await gotoTransactions(page, e2eSession);
   const csv = `Nome\nLan sem obrigatorios\n`;
   await uploadCsv(page, csv);

   const unmapped = page.getByTestId("unmapped-required").first();
   await expect(unmapped).toBeVisible();
});

test("MON-982: mesma coluna do arquivo não pode ser mapeada para duas colunas da tabela", async ({
   page,
   e2eSession,
}) => {
   await gotoTransactions(page, e2eSession);
   const csv = `Nome,Data,Valor,Tipo\nLan X,01/01/2026,100.00,Despesa\n`;
   await uploadCsv(page, csv);

   const vencimentoButton = page
      .getByTestId("mapping-header-button")
      .filter({ hasText: /^Não mapeado$/ })
      .first();
   await vencimentoButton.click();
   await page.getByRole("option", { name: "Data", exact: true }).click();

   const dataMappings = page
      .getByTestId("mapping-header-button")
      .filter({ hasText: /^Data$/ });
   await expect(
      dataMappings,
      "header do arquivo 'Data' não pode aparecer em dois mapeamentos",
   ).toHaveCount(1);
});
