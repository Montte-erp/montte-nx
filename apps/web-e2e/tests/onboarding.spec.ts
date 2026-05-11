import { test as base, expect, type Page } from "@playwright/test";
import { z } from "zod";
import { signUpViaApi, type TestUser } from "../features/auth";
import {
   countMemberOrgsByEmail,
   deleteUserByEmail,
   findFirstOrgByUserEmail,
   findTeamByOrgAndSlug,
   findTeamsByOrgSlug,
   markOnboardingIncomplete,
} from "../helpers/db";

const test = base.extend<{ user: TestUser }>({
   storageState: { cookies: [], origins: [] },
   user: async ({}, use) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const u: TestUser = {
         email: `e2e-onb-${id}@test.local`,
         password: "Test12345!",
         name: "E2E Onboarding",
         workspace: `E2E Onboarding ${id}`,
      };
      await use(u);
      await deleteUserByEmail(u.email);
   },
});

const onboardingProductsSchema = z.array(
   z.enum(["finance", "contacts", "services"]),
);

async function toggleFeature(page: Page, label: RegExp) {
   const card = page.getByRole("button", { name: label });
   await expect(card).toBeVisible({ timeout: 15_000 });
   const before = await card.getAttribute("aria-pressed");
   const target = before === "true" ? "false" : "true";
   await expect(async () => {
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", target, {
         timeout: 1_500,
      });
   }).toPass({ timeout: 15_000 });
}

async function continueToCompany(page: Page) {
   const next = page.getByRole("button", { name: "Continuar" });
   await expect(next).toBeEnabled();
   await next.click();
}

async function fillCompanyAndSubmit(page: Page, workspace: string) {
   await page.getByRole("textbox", { name: "Nome da empresa" }).fill(workspace);
   await page.getByRole("button", { name: "Concluir" }).click();
   await page.waitForURL((url) => /^\/[^/]+\/[^/]+\//.test(url.pathname), {
      timeout: 30_000,
      waitUntil: "commit",
   });
}

async function completeFirstOnboarding(
   page: Page,
   user: TestUser,
   featureLabels: RegExp[],
) {
   await page.goto("/");
   for (const label of featureLabels) {
      await toggleFeature(page, label);
   }
   await continueToCompany(page);
   await fillCompanyAndSubmit(page, user.workspace);
}

test("happy path finance: validações dos botões + seed correto", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await page.goto("/");

   await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
   await toggleFeature(page, /Finanças/);
   await continueToCompany(page);
   await expect(page).toHaveURL(/step=company/);
   expect(new URL(page.url()).search).toContain(encodeURIComponent("finance"));

   const submit = page.getByRole("button", { name: "Concluir" });
   const input = page.getByRole("textbox", { name: "Nome da empresa" });
   await expect(submit).toBeDisabled();
   await input.fill("A");
   await expect(submit).toBeDisabled();
   await input.fill(user.workspace);
   await expect(submit).toBeEnabled();
   await submit.click();
   await page.waitForURL((url) => /^\/[^/]+\/[^/]+\//.test(url.pathname), {
      timeout: 30_000,
      waitUntil: "commit",
   });

   const org = await findFirstOrgByUserEmail(user.email);
   if (!org?.slug) throw new Error("Org não foi criada.");
   const team = await findTeamByOrgAndSlug(org.slug, "principal");
   expect(org.onboardingCompleted).toBeTruthy();
   expect(team?.onboardingCompleted).toBeTruthy();
   expect(team?.onboardingProducts).toEqual(["finance"]);
});

test("contacts + services + multi-org via ?new=true", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, [/Negócios/, /Serviços/]);

   const firstOrg = await findFirstOrgByUserEmail(user.email);
   if (!firstOrg?.slug) throw new Error("Primeira org não foi criada.");
   const firstTeam = await findTeamByOrgAndSlug(firstOrg.slug, "principal");
   if (!firstTeam)
      throw new Error("Time principal da primeira org não foi criado.");
   const onboardingProducts = onboardingProductsSchema.parse(
      firstTeam.onboardingProducts,
   );
   expect([...onboardingProducts].sort()).toEqual(["contacts", "services"]);

   await page.goto("/onboarding?new=true");
   await toggleFeature(page, /Finanças/);
   await continueToCompany(page);
   await fillCompanyAndSubmit(page, `${user.workspace} Two`);

   expect(await countMemberOrgsByEmail(user.email)).toBe(2);
});

test("Voltar preserva as features selecionadas", async ({ page, user }) => {
   await signUpViaApi(page.request, user);
   await page.goto("/");
   await toggleFeature(page, /Negócios/);
   await toggleFeature(page, /Serviços/);
   await continueToCompany(page);
   await expect(page).toHaveURL(/step=company/);

   await page.getByRole("button", { name: "Voltar" }).click();
   await expect(page).toHaveURL(/step=features/);
   await expect(page.getByRole("button", { name: /Negócios/ })).toHaveAttribute(
      "aria-pressed",
      "true",
   );
   await expect(page.getByRole("button", { name: /Serviços/ })).toHaveAttribute(
      "aria-pressed",
      "true",
   );
});

test("nenhuma feature selecionada → onboardingProducts vazio", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await page.goto("/");
   await continueToCompany(page);
   await fillCompanyAndSubmit(page, user.workspace);

   const org = await findFirstOrgByUserEmail(user.email);
   if (!org?.slug) throw new Error("Org não foi criada.");
   const team = await findTeamByOrgAndSlug(org.slug, "principal");
   expect(team?.onboardingProducts).toEqual([]);
});

test("guards de search params redirecionam para o step correto", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);

   await page.goto("/onboarding?step=profile");
   await expect(page).toHaveURL(/step=features/);
});

test("já onboarded volta para home; estado incompleto é reparado", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, [/Finanças/]);

   await page.goto("/onboarding");
   await page.waitForURL((url) => /^\/[^/]+\/[^/]+\//.test(url.pathname), {
      timeout: 15_000,
      waitUntil: "commit",
   });

   const org = await findFirstOrgByUserEmail(user.email);
   if (!org?.slug) throw new Error("Org não foi criada.");
   await markOnboardingIncomplete(org.slug);

   await page.goto("/onboarding");
   await page.waitForURL((url) => /^\/[^/]+\/[^/]+\//.test(url.pathname), {
      timeout: 15_000,
      waitUntil: "commit",
   });

   const orgAfter = await findFirstOrgByUserEmail(user.email);
   const teamsAfter = await findTeamsByOrgSlug(org.slug);
   expect(orgAfter?.onboardingCompleted).toBeTruthy();
   expect(teamsAfter.every((t) => t.onboardingCompleted)).toBeTruthy();
});

test("/onboarding sem sessão redireciona para /auth/sign-in", async ({
   page,
}) => {
   await page.goto("/onboarding");
   await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
});
