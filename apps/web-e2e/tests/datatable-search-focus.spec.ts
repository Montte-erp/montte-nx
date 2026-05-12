import { expect, test } from "../fixtures";

test("search input keeps focus during fast typing (debounced)", async ({
   page,
   e2eSession,
}) => {
   await page.goto(`/${e2eSession.orgSlug}/${e2eSession.teamSlug}/contacts`);
   await expect(page.getByRole("heading", { name: "Contatos" })).toBeVisible();

   const input = page.getByRole("searchbox", { name: /Buscar contatos/i });
   await input.click();
   await expect(input).toBeFocused();

   for (const ch of "abcdefghij") {
      await page.keyboard.type(ch, { delay: 20 });
      await expect(input).toBeFocused();
   }

   await expect(input).toHaveValue("abcdefghij");
});
