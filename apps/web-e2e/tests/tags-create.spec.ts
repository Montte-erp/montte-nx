import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test as base, type E2ESession } from "../fixtures";
import {
   deleteTagById,
   findTagByName,
   findTeamByOrgAndSlug,
} from "../helpers/db";

const stamp = () => randomUUID();

const test = base.extend<{ createdTagIds: string[] }>({
   createdTagIds: async ({}, use) => {
      await use([]);
   },
});

async function gotoTags(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/tags`);
   await expect(
      page.getByRole("heading", { name: "Centros de Custo" }),
   ).toBeVisible();
}

async function rememberCreatedTag(
   session: E2ESession,
   name: string,
   createdTagIds: string[],
) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const tag = await findTagByName(team.id, name);
   if (!tag) return;
   createdTagIds.push(tag.id);
}

test.afterEach(async ({ e2eSession, createdTagIds }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdTagIds.splice(0)) {
      await deleteTagById(team.id, id);
   }
});

test("cria centro de custo via side sheet", async ({
   page,
   e2eSession,
   createdTagIds,
}) => {
   const name = `Centro E2E ${stamp()}`;
   const description = "Campanhas e eventos";

   await gotoTags(page, e2eSession);
   await page.getByRole("button", { name: "Novo Centro de Custo" }).click();

   const sheet = page.getByRole("dialog");
   await sheet.getByLabel("Nome").fill(name);
   await sheet.getByLabel("Descrição").fill(description);

   const submit = sheet.getByRole("button", { name: "Criar centro de custo" });
   await expect(submit).toBeEnabled();
   await submit.click();

   await expect(
      page.getByText("Centro de custo criado com sucesso."),
   ).toBeVisible();
   await rememberCreatedTag(e2eSession, name, createdTagIds);

   await page
      .getByRole("textbox", { name: "Buscar centros de custo..." })
      .fill(name);
   await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();

   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;
   const tag = await findTagByName(team.id, name);
   expect(tag?.description).toBe(description);
});

test("validação: nome curto bloqueia submit", async ({ page, e2eSession }) => {
   await gotoTags(page, e2eSession);
   await page.getByRole("button", { name: "Novo Centro de Custo" }).click();

   const sheet = page.getByRole("dialog");
   const submit = sheet.getByRole("button", { name: "Criar centro de custo" });

   await expect(submit).toBeDisabled();

   await sheet.getByLabel("Nome").fill("a");
   await sheet.getByLabel("Nome").blur();
   await expect(
      sheet.getByText("Nome deve ter no mínimo 2 caracteres."),
   ).toBeVisible();
   await expect(submit).toBeDisabled();
});

test("cancelar fecha sheet sem criar", async ({ page, e2eSession }) => {
   await gotoTags(page, e2eSession);
   await page.getByRole("button", { name: "Novo Centro de Custo" }).click();
   const sheet = page.getByRole("dialog");

   const name = "Não deve criar";
   await sheet.getByLabel("Nome").fill(name);
   await sheet.getByRole("button", { name: "Cancelar" }).click();

   await expect(sheet).not.toBeVisible();
   await expect(
      page.getByRole("row").filter({ hasText: name }),
   ).not.toBeVisible();
});
