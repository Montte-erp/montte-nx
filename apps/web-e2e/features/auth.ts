import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { findFirstOrgByUserEmail } from "../helpers/db";
import type { E2EUser } from "../helpers/auth";

export type TestUser = E2EUser;

export async function signUpViaApi(
   request: APIRequestContext,
   user: TestUser,
): Promise<"created" | "exists"> {
   const res = await request.post("/api/auth/sign-up/email", {
      data: { email: user.email, password: user.password, name: user.name },
   });
   if (res.ok()) return "created";
   const body = await res.text();
   if (
      res.status() === 422 ||
      /USER_ALREADY_EXISTS|already exists|EMAIL_TAKEN/i.test(body)
   ) {
      return "exists";
   }
   throw new Error(`signup failed ${res.status()}: ${body}`);
}

export async function signInViaApi(request: APIRequestContext, user: TestUser) {
   const res = await request.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: user.password },
   });
   expect(
      res.ok(),
      `signin failed ${res.status()}: ${await res.text()}`,
   ).toBeTruthy();
}

function parseSlugsFromUrl(url: string): {
   orgSlug: string;
   teamSlug: string;
} {
   const match = new URL(url).pathname.match(/^\/(?!auth\/)([^/]+)\/([^/]+)\//);
   if (!match) throw new Error(`Could not parse slugs from ${url}`);
   return { orgSlug: match[1]!, teamSlug: match[2]! };
}

async function waitForDashboardUrl(page: Page, timeout: number) {
   await page.waitForFunction(
      () => /^\/(?!auth\/)[^/]+\/[^/]+\//.test(window.location.pathname),
      undefined,
      { timeout },
   );
}

async function pickFeature(page: Page, label: RegExp) {
   const card = page.getByRole("button", { name: label });
   await expect(card).toBeVisible({ timeout: 15_000 });
   await expect(async () => {
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true", {
         timeout: 1_500,
      });
   }).toPass({ timeout: 15_000 });
}

export async function completeOnboarding(page: Page, workspace: string) {
   await page.goto("/");

   await pickFeature(page, /Finanças/);
   const continueButton = page.getByRole("button", { name: "Continuar" });
   await expect(continueButton).toBeEnabled();
   await continueButton.click();

   await page.getByRole("textbox", { name: "Nome da empresa" }).fill(workspace);
   await page.getByRole("button", { name: "Concluir" }).click();

   await waitForDashboardUrl(page, 30_000);
   await page.goto("/");
   await waitForDashboardUrl(page, 15_000);
   return parseSlugsFromUrl(page.url());
}

export async function createAdditionalOrganization(
   page: Page,
   workspace: string,
) {
   await page.goto("/onboarding?new=true");

   await pickFeature(page, /Negócios/);
   await pickFeature(page, /Serviços/);
   const continueButton = page.getByRole("button", { name: "Continuar" });
   await expect(continueButton).toBeEnabled();
   await continueButton.click();

   await page.getByRole("textbox", { name: "Nome da empresa" }).fill(workspace);
   await page.getByRole("button", { name: "Concluir" }).click();

   await waitForDashboardUrl(page, 30_000);
   return parseSlugsFromUrl(page.url());
}

async function signedInLandingSlugs(page: Page) {
   await page.goto("/");
   await waitForDashboardUrl(page, 15_000);
   return parseSlugsFromUrl(page.url());
}

export async function ensureE2EUserSession(page: Page, user: TestUser) {
   const status = await signUpViaApi(page.request, user);
   if (status === "created") {
      const slugs = await completeOnboarding(page, user.workspace);
      return slugs;
   }

   const existingOrg = await findFirstOrgByUserEmail(user.email);
   await signInViaApi(page.request, user);

   if (!existingOrg || !existingOrg.onboardingCompleted) {
      return completeOnboarding(page, user.workspace);
   }

   return signedInLandingSlugs(page);
}
