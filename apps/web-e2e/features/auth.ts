import { expect, type APIRequestContext, type Page } from "@playwright/test";

export type TestUser = {
   email: string;
   password: string;
   name: string;
   workspace: string;
};

export function makeTestUser(prefix = "e2e"): TestUser {
   const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
   return {
      email: `${prefix}-${stamp}@test.local`,
      password: "Test12345!",
      name: "E2E Tester",
      workspace: `E2E ${stamp}`,
   };
}

export async function signUpViaApi(request: APIRequestContext, user: TestUser) {
   const res = await request.post("/api/auth/sign-up/email", {
      data: { email: user.email, password: user.password, name: user.name },
   });
   expect(
      res.ok(),
      `signup failed ${res.status()}: ${await res.text()}`,
   ).toBeTruthy();
}

export async function signUp(page: Page, user: TestUser) {
   await page.goto("/auth/sign-up");
   await page
      .getByRole("textbox", { name: "Nome" })
      .pressSequentially(user.name);
   await page
      .getByRole("textbox", { name: "Email" })
      .pressSequentially(user.email);
   await page.getByRole("textbox", { name: "Email" }).press("Tab");
   await page.getByRole("button", { name: "Proximo" }).click();

   await page
      .getByLabel("Senha", { exact: true })
      .pressSequentially(user.password);
   await page.getByLabel("Confirmar Senha").pressSequentially(user.password);
   await page.getByLabel("Confirmar Senha").press("Tab");

   const signUpResponse = page.waitForResponse(
      (r) =>
         r.url().includes("/api/auth/sign-up/email") &&
         r.request().method() === "POST",
   );
   await page.getByRole("button", { name: "Enviar" }).click();
   const res = await signUpResponse;
   expect(res.status(), `signup status ${res.status()}`).toBe(200);
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

export async function signUpAndOnboard(page: Page, user = makeTestUser()) {
   await signUpViaApi(page.request, user);
   const slugs = await completeOnboarding(page, user.workspace);
   return { user, ...slugs };
}
