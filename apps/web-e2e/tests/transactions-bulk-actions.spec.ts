import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   deleteTransactionById,
   findTeamByOrgAndSlug,
   findTransactionById,
   findTransactionByName,
   insertBankAccount,
   insertExpenseTransaction,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const createdTxIds: string[] = [];
const createdAccountIds: string[] = [];

async function gotoTransactions(
   page: Page,
   session: E2ESession,
   search: string,
) {
   await page.goto(
      `/${session.orgSlug}/${session.teamSlug}/transactions?search=${encodeURIComponent(search)}`,
   );
   await expect(
      page.getByRole("heading", { name: "Lançamentos" }),
   ).toBeVisible();
}

async function setupTwoTransactions(session: E2ESession) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) throw new Error("team não encontrado");

   const accountName = `Bulk Conta ${stamp()}`;
   const account = await insertBankAccount(team.id, accountName);
   if (!account) throw new Error("failed to create bank account");
   createdAccountIds.push(account.id);

   const tag = `Bulk ${stamp()}`;
   const txA = await insertExpenseTransaction(
      team.id,
      account.id,
      `${tag} A`,
      "pending",
   );
   const txB = await insertExpenseTransaction(
      team.id,
      account.id,
      `${tag} B`,
      "pending",
   );
   createdTxIds.push(txA.id, txB.id);

   return { team, tag, txAId: txA.id, txBId: txB.id };
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

test("ação em massa 'Ignorar lançamentos' cancela seleção", async ({
   page,
   e2eSession,
}) => {
   const { team, tag, txAId, txBId } = await setupTwoTransactions(e2eSession);

   await gotoTransactions(page, e2eSession, tag);
   await expect(page.getByRole("cell", { name: `${tag} A` })).toBeVisible();
   await expect(page.getByRole("cell", { name: `${tag} B` })).toBeVisible();

   await page.getByRole("checkbox", { name: "Selecionar todos" }).click();

   const ignoreBtn = page.getByRole("button", { name: "Ignorar lançamentos" });
   await expect(ignoreBtn).toBeVisible();
   await expect(
      page.getByRole("button", { name: "Marcar como pagas" }),
   ).toHaveCount(0);

   await ignoreBtn.click();
   const dialog = page.getByRole("alertdialog");
   await expect(dialog).toBeVisible();
   await dialog.getByRole("button", { name: "Ignorar" }).click();
   await expect(dialog).not.toBeVisible();
   await expect(ignoreBtn).toHaveCount(0);
   await expect(
      page.getByRole("checkbox", { name: "Selecionar todos" }),
   ).not.toBeChecked();

   await expect
      .poll(async () => (await findTransactionById(team.id, txAId))?.status)
      .toBe("cancelled");
   await expect
      .poll(async () => (await findTransactionById(team.id, txBId))?.status)
      .toBe("cancelled");
});

test("menu Status em massa não expõe 'Cancelado'", async ({
   page,
   e2eSession,
}) => {
   const { tag } = await setupTwoTransactions(e2eSession);

   await gotoTransactions(page, e2eSession, tag);
   await expect(page.getByRole("cell", { name: `${tag} A` })).toBeVisible();
   await page.getByRole("checkbox", { name: "Selecionar todos" }).click();

   await page.getByRole("button", { name: "Status" }).click();
   await expect(page.getByRole("button", { name: "Pendente" })).toBeVisible();
   await expect(page.getByRole("button", { name: "Efetivado" })).toBeVisible();
   await expect(page.getByRole("button", { name: "Cancelado" })).toHaveCount(0);
});
