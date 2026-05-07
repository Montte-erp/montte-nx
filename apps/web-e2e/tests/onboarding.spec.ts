import { test as base, expect, type Page } from "@playwright/test";
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

async function pickGoalAndContinue(page: Page, goalLabel: RegExp) {
   const card = page.getByRole("button", { name: goalLabel });
   await expect(card).toBeVisible({ timeout: 15_000 });
   await expect(async () => {
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true", {
         timeout: 1_500,
      });
   }).toPass({ timeout: 15_000 });
   const next = page.getByRole("button", { name: "Continuar" });
   await expect(next).toBeEnabled();
   await next.click();
}

async function fillCompanyAndSubmit(page: Page, workspace: string) {
   await page.getByRole("textbox", { name: "Nome da empresa" }).fill(workspace);
   await page.getByRole("button", { name: "Concluir" }).click();
   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 30_000 });
}

async function completeFirstOnboarding(
   page: Page,
   user: TestUser,
   goalLabel: RegExp,
) {
   await page.goto("/");
   await pickGoalAndContinue(page, goalLabel);
   await fillCompanyAndSubmit(page, user.workspace);
}

test("happy path finance: validações dos botões + seed correto", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await page.goto("/");

   await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
   await pickGoalAndContinue(page, /Organizar meu financeiro/);
   await expect(page).toHaveURL(/step=company/);
   await expect(page).toHaveURL(/goal=finance/);

   const submit = page.getByRole("button", { name: "Concluir" });
   const input = page.getByRole("textbox", { name: "Nome da empresa" });
   await expect(submit).toBeDisabled();
   await input.fill("A");
   await expect(submit).toBeDisabled();
   await input.fill(user.workspace);
   await expect(submit).toBeEnabled();
   await submit.click();
   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 30_000 });

   const org = await findFirstOrgByUserEmail(user.email);
   if (!org?.slug) throw new Error("Org não foi criada.");
   const team = await findTeamByOrgAndSlug(org.slug, "principal");
   expect(org.onboardingCompleted).toBeTruthy();
   expect(team?.onboardingCompleted).toBeTruthy();
   expect(team?.onboardingProducts).toEqual(["finance"]);
});

test("clients_services + multi-org via ?new=true", async ({ page, user }) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Gerenciar clientes e serviços/);

   const firstOrg = await findFirstOrgByUserEmail(user.email);
   if (!firstOrg?.slug) throw new Error("Primeira org não foi criada.");
   const firstTeam = await findTeamByOrgAndSlug(firstOrg.slug, "principal");
   expect(firstTeam?.onboardingProducts).toEqual(["contacts", "services"]);

   await page.goto("/onboarding?new=true");
   await pickGoalAndContinue(page, /Organizar meu financeiro/);
   await fillCompanyAndSubmit(page, `${user.workspace} Two`);

   expect(await countMemberOrgsByEmail(user.email)).toBe(2);
});

test("Voltar preserva o goal selecionado", async ({ page, user }) => {
   await signUpViaApi(page.request, user);
   await page.goto("/");
   await pickGoalAndContinue(page, /Gerenciar clientes e serviços/);
   await expect(page).toHaveURL(/step=company/);

   await page.getByRole("button", { name: "Voltar" }).click();
   await expect(page).toHaveURL(/step=goal/);
   await expect(
      page.getByRole("button", { name: /Gerenciar clientes e serviços/ }),
   ).toHaveAttribute("aria-pressed", "true");
});

test("goal 'pick_myself' não pré-seleciona produtos", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Vou escolher sozinho/);

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

   await page.goto("/onboarding?step=company");
   await expect(page).toHaveURL(/step=goal/);

   await page.goto("/onboarding?step=profile");
   await expect(page).toHaveURL(/step=goal/);

   await completeFirstOnboarding(page, user, /Organizar meu financeiro/);

   await page.goto("/onboarding?new=true&step=company");
   await expect(page).toHaveURL(/step=goal/);
});

test("já onboarded volta para home; estado incompleto é reparado", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Organizar meu financeiro/);

   await page.goto("/onboarding");
   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 15_000 });

   const org = await findFirstOrgByUserEmail(user.email);
   if (!org?.slug) throw new Error("Org não foi criada.");
   await markOnboardingIncomplete(org.slug);

   await page.goto("/onboarding");
   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 15_000 });

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
