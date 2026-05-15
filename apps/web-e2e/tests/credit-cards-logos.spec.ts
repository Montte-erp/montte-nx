import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   deleteCreditCardById,
   findCreditCardByName,
   findTeamByOrgAndSlug,
   insertBankAccount,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const createdCardIds: string[] = [];
const createdBankAccountIds: string[] = [];

async function gotoCreditCards(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/credit-cards`);
   await expect(
      page.getByRole("heading", { name: "Cartões de Crédito" }),
   ).toBeVisible();
}

async function setupItauAccount(session: E2ESession) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) throw new Error("team not found");
   const account = await insertBankAccount(team.id, `Itaú E2E ${stamp()}`, {
      bankCode: "341",
      bankName: "Itaú",
   });
   if (!account) throw new Error("failed to create bank account");
   createdBankAccountIds.push(account.id);
   return account;
}

async function rememberCard(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const card = await findCreditCardByName(team.id, name);
   if (!card) return;
   createdCardIds.push(card.id);
}

async function expectCreditCardRowVisible(
   page: Page,
   session: E2ESession,
   name: string,
) {
   await page.goto(
      `/${session.orgSlug}/${session.teamSlug}/credit-cards?search=${encodeURIComponent(name)}`,
   );
   await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
}

test.afterEach(async ({ e2eSession }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdCardIds.splice(0)) {
      await deleteCreditCardById(team.id, id);
   }
   for (const id of createdBankAccountIds.splice(0)) {
      await deleteBankAccountById(team.id, id);
   }
});

test("exibe logo do banco emissor e da bandeira na listagem", async ({
   page,
   e2eSession,
}) => {
   const account = await setupItauAccount(e2eSession);
   const name = `Cartão Logo ${stamp()}`;

   await gotoCreditCards(page, e2eSession);
   await page.getByRole("button", { name: "Novo Cartão" }).click();

   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Nome").fill(name);
   await sheet.getByLabel("Conta vinculada").click();
   await page.getByRole("option", { name: account.name }).click();
   await sheet.getByLabel("Bandeira").click();
   await page.getByRole("option", { name: "Visa" }).click();
   await sheet.getByLabel("4 últimos dígitos").fill("1234");
   await sheet.getByLabel("Limite").fill("1000,00");
   await sheet.getByRole("button", { name: "Criar cartão" }).click();

   await expect(page.getByText("Cartão criado com sucesso.")).toBeVisible();
   await rememberCard(e2eSession, name);
   await expectCreditCardRowVisible(page, e2eSession, name);

   const row = page.getByRole("row", { name: new RegExp(name) });

   await expect(
      row.locator(
         'img[src*="img.logo.dev/visa.com"], img[src*="img.logo.dev/name/visa"], img[src*="cdn.simpleicons.org/visa"]',
      ),
   ).toBeVisible();

   await expect(
      row.locator(
         'img[src*="img.logo.dev/itau.com.br"], img[src*="icons.duckduckgo.com/ip3/itau.com.br.ico"]',
      ),
   ).toBeVisible();

   await expect(row.getByText("Itaú")).toBeVisible();

   await expect(row.getByText("Final 1234")).toBeVisible();

   await expect(row.getByText("Itaú")).toBeVisible();
});

test("autocomplete de banco mostra logos nas opções", async ({
   page,
   e2eSession,
}) => {
   await page.goto(
      `/${e2eSession.orgSlug}/${e2eSession.teamSlug}/bank-accounts`,
   );
   await expect(
      page.getByRole("heading", { name: "Contas Bancárias" }),
   ).toBeVisible();

   await page.getByRole("button", { name: "Nova Conta" }).click();
   const sheet = page.getByRole("dialog");
   await sheet.getByPlaceholder("Digite o nome ou código").fill("nubank");

   const option = page.getByRole("option", { name: /nubank|260/i });
   await expect(option).toBeVisible();
   await expect(
      option.locator(
         'img[src*="img.logo.dev/nubank.com.br"], img[src*="icons.duckduckgo.com/ip3/nubank.com.br.ico"]',
      ),
   ).toBeVisible();
});
