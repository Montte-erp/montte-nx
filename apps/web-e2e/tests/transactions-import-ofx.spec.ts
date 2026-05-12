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

function buildOfx(
   transactions: {
      name: string;
      amount: string;
      type: "DEBIT" | "CREDIT";
      date: string;
      fitid: string;
   }[],
) {
   const stmttrns = transactions
      .map(
         (t) => `<STMTTRN>
<TRNTYPE>${t.type}
<DTPOSTED>${t.date}
<TRNAMT>${t.amount}
<FITID>${t.fitid}
<MEMO>${t.name}
</STMTTRN>`,
      )
      .join("\n");
   return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260131120000
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0001
<ACCTID>12345
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260101
<DTEND>20260131
${stmttrns}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1000.00
<DTASOF>20260131
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;
}

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

async function rememberTx(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const tx = await findTransactionByName(team.id, name);
   if (tx) createdTxIds.push(tx.id);
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

test("MON-888: importa OFX selecionando conta em bulk salva lançamentos com toast único", async ({
   page,
   e2eSession,
}) => {
   const s = stamp();
   const accountName = `OFX Conta ${s}`;
   const txA = `OFX Despesa A ${s}`;
   const txB = `OFX Receita B ${s}`;

   const ofx = buildOfx([
      {
         name: txA,
         amount: "-150.00",
         type: "DEBIT",
         date: "20260105",
         fitid: `FIT-A-${s}`,
      },
      {
         name: txB,
         amount: "250.00",
         type: "CREDIT",
         date: "20260110",
         fitid: `FIT-B-${s}`,
      },
   ]);

   await ensureBankAccount(page, e2eSession, accountName);
   await gotoTransactions(page, e2eSession);

   await page.getByRole("button", { name: "Importar dados" }).click();
   await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
         name: "statement.ofx",
         mimeType: "application/x-ofx",
         buffer: Buffer.from(ofx, "utf8"),
      });

   await expect(page.getByText("Importando")).toBeVisible();
   await expect(page.getByRole("row").filter({ hasText: txA })).toBeVisible();
   await expect(page.getByRole("row").filter({ hasText: txB })).toBeVisible();

   await page
      .getByRole("row")
      .filter({ hasText: txA })
      .getByLabel("Selecionar linha")
      .click();
   await page
      .getByRole("row")
      .filter({ hasText: txB })
      .getByLabel("Selecionar linha")
      .click();
   await page.getByRole("button", { name: "Definir conta" }).click();
   await page.getByRole("option", { name: accountName }).click();

   await page.getByRole("button", { name: /Salvar 2 linha/ }).click();
   await page.getByRole("button", { name: "Salvar" }).click();

   await expect(
      page.getByText(/linha\(s\) importada\(s\) com sucesso/),
   ).toBeVisible();
   await expect(page.getByText(/com erro/)).toHaveCount(0);

   await expect(page.getByRole("row").filter({ hasText: txA })).toBeVisible();
   await expect(page.getByRole("row").filter({ hasText: txB })).toBeVisible();

   await rememberTx(e2eSession, txA);
   await rememberTx(e2eSession, txB);
});

test("MON-888: importa OFX sem conta exibe erro e não dispara toast de sucesso", async ({
   page,
   e2eSession,
}) => {
   const s = stamp();
   const txA = `OFX Sem Conta ${s}`;

   const ofx = buildOfx([
      {
         name: txA,
         amount: "-50.00",
         type: "DEBIT",
         date: "20260115",
         fitid: `FIT-NC-${s}`,
      },
   ]);

   await gotoTransactions(page, e2eSession);

   await page.getByRole("button", { name: "Importar dados" }).click();
   await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
         name: "statement.ofx",
         mimeType: "application/x-ofx",
         buffer: Buffer.from(ofx, "utf8"),
      });

   await expect(page.getByRole("row").filter({ hasText: txA })).toBeVisible();

   await page.getByRole("button", { name: /Salvar 1 linha/ }).click();
   await page.getByRole("button", { name: "Salvar" }).click();

   await expect(
      page.getByText(
         "Nenhum lançamento válido para importar. Preencha data, valor e conta ou cartão.",
      ),
   ).toBeVisible();
   await expect(
      page.getByText(/linha\(s\) importada\(s\) com sucesso/),
   ).toHaveCount(0);

   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (team) {
      const persisted = await findTransactionByName(team.id, txA);
      expect(persisted).toBeFalsy();
   }
});
