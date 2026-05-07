import { test as base, expect, type Page } from "@playwright/test";
import { signUpViaApi, type TestUser } from "../features/auth";
import {
   addMemberToOrg,
   clearUserName,
   countMemberOrgsByEmail,
   deleteUserByEmail,
   findFirstOrgByUserEmail,
   findTeamByOrgAndSlug,
   findTeamsByOrgSlug,
   findUserByEmail,
   markOnboardingIncomplete,
} from "../helpers/db";

const test = base.extend<{ user: TestUser }>({
   storageState: { cookies: [], origins: [] },
   user: async ({ browser: _browser }, use) => {
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
   await expect(page.getByRole("button", { name: goalLabel })).toBeVisible({
      timeout: 15_000,
   });
   await page.getByRole("button", { name: goalLabel }).click();
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

// ─── Categoria 1 — Novo usuário (sem orgs) ───────────────────────────────────

test("goal 'finance' faz seed apenas de finance", async ({ page, user }) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Organizar meu financeiro/);

   const org = await findFirstOrgByUserEmail(user.email);
   expect(org?.onboardingCompleted).toBeTruthy();
   if (!org?.slug) throw new Error("Organização não foi criada.");
   const team = await findTeamByOrgAndSlug(org.slug, "principal");
   expect(team?.onboardingProducts).toEqual(["finance"]);
   expect(team?.onboardingCompleted).toBeTruthy();
});

test("goal 'clients_services' faz seed de contacts e services", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Gerenciar clientes e serviços/);

   const org = await findFirstOrgByUserEmail(user.email);
   if (!org?.slug) throw new Error("Organização não foi criada.");
   const team = await findTeamByOrgAndSlug(org.slug, "principal");
   expect(team?.onboardingProducts).toEqual(["contacts", "services"]);
});

test("goal 'pick_myself' faz seed apenas de finance", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Vou escolher sozinho/);

   const org = await findFirstOrgByUserEmail(user.email);
   if (!org?.slug) throw new Error("Organização não foi criada.");
   const team = await findTeamByOrgAndSlug(org.slug, "principal");
   expect(team?.onboardingProducts).toEqual(["finance"]);
});

// ─── Categoria 2 — ProfileStep (usuário sem nome) ────────────────────────────

test("usuário sem nome é forçado para profile e avança para goal após preencher", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await clearUserName(user.email);

   await page.goto("/onboarding");
   await expect(page).toHaveURL(/step=profile/);
   await expect(
      page.getByRole("heading", { name: /Como podemos te chamar\?/ }),
   ).toBeVisible({ timeout: 15_000 });

   await page.getByRole("textbox", { name: "Seu Nome" }).fill("Novo Nome");
   await page.getByRole("button", { name: "Continuar" }).click();

   await expect(page).toHaveURL(/step=goal/);
   await expect(
      page.getByRole("heading", {
         name: /O que você quer fazer primeiro na Montte\?/,
      }),
   ).toBeVisible();

   const u = await findUserByEmail(user.email);
   expect(u?.name).toBe("Novo Nome");
});

test("usuário com nome em step=profile (sem activeOrg) redireciona para goal", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);

   await page.goto("/onboarding?step=profile");
   await expect(page).toHaveURL(/step=goal/);
});

// ─── Categoria 3 — Guards de search params ───────────────────────────────────

test("recusa avançar para company sem ter escolhido um goal", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);

   await page.goto("/onboarding?step=company");
   await expect(page).toHaveURL(/step=goal/);
   await expect(
      page.getByRole("heading", {
         name: /O que você quer fazer primeiro na Montte\?/,
      }),
   ).toBeVisible();
});

test("?new=true&step=company sem goal redireciona para step=goal", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Organizar meu financeiro/);

   await page.goto("/onboarding?new=true&step=company");
   await expect(page).toHaveURL(/step=goal/);
});

// ─── Categoria 4 — Org já completa / repair ──────────────────────────────────

test("usuário já onboarded é redirecionado de /onboarding para home", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Organizar meu financeiro/);

   await page.goto("/onboarding");
   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 15_000 });
});

test("fixOnboarding repara org+team incompletos e redireciona para home", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Organizar meu financeiro/);

   const org = await findFirstOrgByUserEmail(user.email);
   if (!org?.slug) throw new Error("Organização não foi criada.");
   await markOnboardingIncomplete(org.slug);

   await page.goto("/onboarding");
   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 15_000 });

   const orgAfter = await findFirstOrgByUserEmail(user.email);
   expect(orgAfter?.onboardingCompleted).toBeTruthy();
   const teams = await findTeamsByOrgSlug(org.slug);
   expect(teams.every((t) => t.onboardingCompleted)).toBeTruthy();
});

// ─── Categoria 5 — Multi-org (?new=true) ─────────────────────────────────────

test("?new=true cria 2ª org com goal independente da primeira", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await completeFirstOnboarding(page, user, /Gerenciar clientes e serviços/);

   const secondName = `${user.workspace} Two`;
   await page.goto("/onboarding?new=true");
   await pickGoalAndContinue(page, /Organizar meu financeiro/);
   await fillCompanyAndSubmit(page, secondName);

   expect(await countMemberOrgsByEmail(user.email)).toBe(2);
});

// ─── Categoria 6 — Validação / UX ────────────────────────────────────────────

test("CompanyStep: 'Concluir' desabilitado até nome ter 2+ caracteres", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await page.goto("/");
   await pickGoalAndContinue(page, /Organizar meu financeiro/);

   const submit = page.getByRole("button", { name: "Concluir" });
   const input = page.getByRole("textbox", { name: "Nome da empresa" });
   await expect(submit).toBeDisabled();
   await input.fill("A");
   await expect(submit).toBeDisabled();
   await input.fill("AB");
   await expect(submit).toBeEnabled();
});

test("GoalStep: 'Continuar' desabilitado enquanto nenhum goal estiver selecionado", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await page.goto("/onboarding");
   await expect(page).toHaveURL(/step=goal/);

   await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
   await page.getByRole("button", { name: /Vou escolher sozinho/ }).click();
   await expect(page).toHaveURL(/goal=pick_myself/);
   await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("Voltar de company para goal preserva a meta selecionada", async ({
   page,
   user,
}) => {
   await signUpViaApi(page.request, user);
   await page.goto("/");

   await pickGoalAndContinue(page, /Gerenciar clientes e serviços/);
   await expect(page).toHaveURL(/step=company/);
   await expect(page).toHaveURL(/goal=clients_services/);

   await page.getByRole("button", { name: "Voltar" }).click();
   await expect(page).toHaveURL(/step=goal/);
   await expect(
      page.getByRole("button", { name: /Gerenciar clientes e serviços/ }),
   ).toHaveAttribute("aria-pressed", "true");
});

// ─── Categoria 7 — Não autenticado ───────────────────────────────────────────

test("/onboarding sem sessão redireciona para /auth/sign-in", async ({
   page,
}) => {
   await page.goto("/onboarding");
   await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
});

// ─── Categoria 8 — Magic link / convite (1-step Profile) ─────────────────────

test("magic-link: novo membro com org herdada e sem nome vê apenas o step Profile", async ({
   page,
}) => {
   const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
   const owner: TestUser = {
      email: `e2e-onb-owner-${id}@test.local`,
      password: "Test12345!",
      name: "Owner",
      workspace: `Owner ${id}`,
   };
   const guest: TestUser = {
      email: `e2e-onb-guest-${id}@test.local`,
      password: "Test12345!",
      name: "Guest",
      workspace: "",
   };

   try {
      await signUpViaApi(page.request, owner);
      await completeFirstOnboarding(page, owner, /Organizar meu financeiro/);
      const ownerOrg = await findFirstOrgByUserEmail(owner.email);
      if (!ownerOrg?.id || !ownerOrg.slug) {
         throw new Error("Org do owner não foi criada.");
      }

      await page.request.post("/api/auth/sign-out");
      await page.context().clearCookies();

      await signUpViaApi(page.request, guest);
      await clearUserName(guest.email);
      const guestUser = await findUserByEmail(guest.email);
      if (!guestUser?.id) throw new Error("Guest não foi criado.");
      await addMemberToOrg(guestUser.id, ownerOrg.id);

      await page.request.post("/api/auth/sign-in/email", {
         data: { email: guest.email, password: guest.password },
      });

      await page.goto("/onboarding");
      await expect(page).toHaveURL(/step=profile/);
      await expect(
         page.getByRole("heading", { name: /Como podemos te chamar\?/ }),
      ).toBeVisible({ timeout: 15_000 });

      await expect(
         page.getByRole("heading", {
            name: /O que você quer fazer primeiro na Montte\?/,
         }),
      ).toHaveCount(0);
      await expect(
         page.getByRole("heading", { name: /Como se chama sua empresa\?/ }),
      ).toHaveCount(0);

      await page.getByRole("textbox", { name: "Seu Nome" }).fill("Magic Guest");
      await page.getByRole("button", { name: "Continuar" }).click();

      await page.waitForURL(new RegExp(`/${ownerOrg.slug}(/|\\?|$)`), {
         timeout: 15_000,
      });
      expect(page.url()).not.toContain("/onboarding");

      const u = await findUserByEmail(guest.email);
      expect(u?.name).toBe("Magic Guest");
   } finally {
      await deleteUserByEmail(guest.email);
      await deleteUserByEmail(owner.email);
   }
});
