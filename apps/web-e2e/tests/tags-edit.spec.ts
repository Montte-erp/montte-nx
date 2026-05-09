import type { Page } from "@playwright/test";
import { expect, test as base, type E2ESession } from "../fixtures";
import {
   deleteTagById,
   findTagById,
   findTagByName,
   findTeamByOrgAndSlug,
   insertTag,
} from "../helpers/db";

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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

test("edita nome de centro de custo via popover na célula", async ({
   page,
   e2eSession,
   createdTagIds,
}) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;

   const original = `Centro Original ${stamp()}`;
   const renamed = `Centro Renomeado ${stamp()}`;
   const tag = await insertTag(team.id, original);
   createdTagIds.push(tag.id);

   await gotoTags(page, e2eSession);
   await page
      .getByRole("textbox", { name: "Buscar centros de custo..." })
      .fill(original);

   const row = page.getByRole("row").filter({ hasText: original });
   await expect(row).toBeVisible();

   await row.getByRole("button", { name: "Editar Nome" }).click();

   const input = page.getByRole("textbox", { name: "Editar Nome" });
   await expect(input).toBeVisible();
   await input.fill(renamed);
   await input.press("Enter");

   await page
      .getByRole("textbox", { name: "Buscar centros de custo..." })
      .fill(renamed);
   await expect(
      page.getByRole("row").filter({ hasText: renamed }),
   ).toBeVisible();

   const updated = await findTagById(tag.id);
   expect(updated?.name).toBe(renamed);

   const stale = await findTagByName(team.id, original);
   expect(stale).toBeUndefined();
});

test("nome curto exibe erro de validação no popover", async ({
   page,
   e2eSession,
   createdTagIds,
}) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).not.toBeNull();
   if (!team) return;

   const original = `Centro Validação ${stamp()}`;
   const tag = await insertTag(team.id, original);
   createdTagIds.push(tag.id);

   await gotoTags(page, e2eSession);
   await page
      .getByRole("textbox", { name: "Buscar centros de custo..." })
      .fill(original);

   const row = page.getByRole("row").filter({ hasText: original });
   await row.getByRole("button", { name: "Editar Nome" }).click();

   const input = page.getByRole("textbox", { name: "Editar Nome" });
   await input.fill("a");
   await input.blur();
   await expect(page.getByText("Mínimo 2 caracteres")).toBeVisible();

   const persisted = await findTagById(tag.id);
   expect(persisted?.name).toBe(original);
});
