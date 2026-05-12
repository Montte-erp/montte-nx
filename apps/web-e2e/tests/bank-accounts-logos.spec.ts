import { expect, test } from "../fixtures";
import {
   deleteBankAccountById,
   findTeamByOrgAndSlug,
   insertBankAccount,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const createdBankAccountIds: string[] = [];

test.afterEach(async ({ e2eSession }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdBankAccountIds.splice(0)) {
      await deleteBankAccountById(team.id, id);
   }
});

test("exibe logo do banco antes do nome da conta na listagem", async ({
   page,
   e2eSession,
}) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) throw new Error("team not found");

   const accountName = `Conta Itaú Logo ${stamp()}`;
   const account = await insertBankAccount(team.id, accountName, {
      bankCode: "341",
      bankName: "Itaú",
   });
   if (!account) throw new Error("failed to create bank account");
   createdBankAccountIds.push(account.id);

   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/bank-accounts?search=${encodeURIComponent(accountName)}`,
   );

   const row = page.getByRole("row").filter({ hasText: accountName });
   await expect(row).toBeVisible();
   await expect(row.getByText("IT", { exact: true })).toBeVisible();
   await expect(row.getByText(accountName)).toBeVisible();
});
