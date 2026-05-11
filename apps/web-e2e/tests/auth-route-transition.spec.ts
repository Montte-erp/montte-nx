import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("não há flicker da tela antiga durante transição entre rotas auth", async ({
   page,
}) => {
   await page.goto("/auth/sign-in");
   await expect(
      page.getByRole("heading", { name: "Entrar no Montte" }),
   ).toBeVisible();

   await page.getByRole("link", { name: /link mágico/i }).click();
   await page.waitForURL("**/auth/magic-link");

   const headingCount = await page.locator("h1").count();
   expect(headingCount).toBe(1);

   await expect(
      page.getByRole("heading", { name: /qual é o seu email/i }),
   ).toBeVisible({ timeout: 300 });

   await expect(
      page.getByRole("heading", { name: "Entrar no Montte" }),
   ).toHaveCount(0);
});

test("apenas um h1 visível em qualquer frame durante navegação", async ({
   page,
}) => {
   await page.goto("/auth/sign-in");
   await expect(
      page.getByRole("heading", { name: "Entrar no Montte" }),
   ).toBeVisible();

   const samples: number[] = [];
   const sampler = setInterval(async () => {
      const count = await page
         .locator("h1")
         .count()
         .catch(() => -1);
      if (count >= 0) samples.push(count);
   }, 16);

   try {
      await page.getByRole("link", { name: /link mágico/i }).click();
      await page.waitForURL("**/auth/magic-link");
      await page.waitForTimeout(400);
   } finally {
      clearInterval(sampler);
   }

   const overlap = samples.filter((c) => c > 1);
   expect(overlap, `h1 duplicado em ${overlap.length} frames`).toHaveLength(0);
});
