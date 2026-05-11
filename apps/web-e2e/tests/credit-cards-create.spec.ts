import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deleteBankAccountById,
   deleteCreditCardById,
   findAnyBankAccount,
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

async function ensureBankAccount(session: E2ESession) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) throw new Error("team not found");
   const existing = await findAnyBankAccount(team.id);
   if (existing) return existing;
   const created = await insertBankAccount(team.id, `Conta E2E ${stamp()}`);
   if (!created) throw new Error("failed to create bank account");
   createdBankAccountIds.push(created.id);
   return created;
}

async function rememberCard(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const card = await findCreditCardByName(team.id, name);
   if (!card) return;
   createdCardIds.push(card.id);
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

test("cria cartão via side sheet com validações", async ({
   page,
   e2eSession,
}) => {
   await ensureBankAccount(e2eSession);
   const name = `Cartão E2E ${stamp()}`;

   await gotoCreditCards(page, e2eSession);
   await page.getByRole("button", { name: "Novo Cartão" }).click();

   const sheet = page.getByRole("dialog");
   await expect(
      sheet.getByRole("heading", { name: "Novo cartão de crédito" }),
   ).toBeVisible();
   const submit = sheet.getByRole("button", { name: "Criar cartão" });

   await expect(submit).toBeDisabled();

   await sheet.getByLabel("Nome").fill("a");
   await sheet.getByLabel("Nome").blur();
   await expect(
      sheet.getByText("Nome deve ter no mínimo 2 caracteres."),
   ).toBeVisible();
   await sheet.getByLabel("Nome").fill(name);

   await sheet.getByLabel("Conta vinculada").click();
   await page.getByRole("option").first().click();

   await expect(submit).toBeEnabled();
   await submit.click();

   await expect(page.getByText("Cartão criado com sucesso.")).toBeVisible();
   await expect(page.getByRole("cell", { name })).toBeVisible();
   await rememberCard(e2eSession, name);
});

test("cancelar fecha sheet sem criar", async ({ page, e2eSession }) => {
   await ensureBankAccount(e2eSession);
   await gotoCreditCards(page, e2eSession);

   await page.getByRole("button", { name: "Novo Cartão" }).click();
   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Nome").fill("Não deve criar");
   await sheet.getByRole("button", { name: "Cancelar" }).click();

   await expect(sheet).not.toBeVisible();
   await expect(
      page.getByRole("cell", { name: "Não deve criar" }),
   ).not.toBeVisible();
});

test("edição inline do nome continua funcionando", async ({
   page,
   e2eSession,
}) => {
   await ensureBankAccount(e2eSession);
   const name = `Cartão Inline ${stamp()}`;
   const renamed = `${name} renomeado`;

   await gotoCreditCards(page, e2eSession);
   await page.getByRole("button", { name: "Novo Cartão" }).click();
   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Nome").fill(name);
   await sheet.getByLabel("Conta vinculada").click();
   await page.getByRole("option").first().click();
   await sheet.getByRole("button", { name: "Criar cartão" }).click();
   await expect(page.getByRole("cell", { name })).toBeVisible();
   await rememberCard(e2eSession, name);

   const cell = page.getByRole("cell", { name });
   await cell.click();
   const inlineInput = cell.getByRole("textbox");
   await expect(inlineInput).toBeVisible();
   await inlineInput.fill(renamed);
   await inlineInput.press("Enter");
   await expect(page.getByRole("cell", { name: renamed })).toBeVisible();
});
