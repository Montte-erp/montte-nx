import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { findOrgByOwnerEmail } from "../helpers/db";
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

export async function completeOnboarding(page: Page, workspace: string) {
   await page.goto("/");

   await expect(page.getByRole("button", { name: "Pular CNPJ" })).toBeVisible({
      timeout: 15_000,
   });
   await page.getByRole("button", { name: "Pular CNPJ" }).click();

   await page.getByRole("textbox", { name: "Nome" }).fill(workspace);
   await page.getByRole("button", { name: "Concluir" }).click();

   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 30_000 });
   await page.goto("/");
   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 15_000 });
   const match = new URL(page.url()).pathname.match(
      /^\/([^/]+)\/([^/]+)\/home/,
   );
   if (!match) throw new Error(`Could not parse slugs from ${page.url()}`);
   return { orgSlug: match[1]!, teamSlug: match[2]! };
}

async function signedInLandingSlugs(page: Page) {
   await page.goto("/");
   await page.waitForURL(/\/[^/]+\/[^/]+\/home/, { timeout: 15_000 });
   const match = new URL(page.url()).pathname.match(
      /^\/([^/]+)\/([^/]+)\/home/,
   );
   if (!match) throw new Error(`Could not parse slugs from ${page.url()}`);
   return { orgSlug: match[1]!, teamSlug: match[2]! };
}

export async function ensureE2EUserSession(page: Page, user: TestUser) {
   const status = await signUpViaApi(page.request, user);
   if (status === "created") {
      const slugs = await completeOnboarding(page, user.workspace);
      return slugs;
   }

   const existingOrg = await findOrgByOwnerEmail(user.email);
   await signInViaApi(page.request, user);

   if (!existingOrg || !existingOrg.onboardingCompleted) {
      return completeOnboarding(page, user.workspace);
   }

   return signedInLandingSlugs(page);
}
