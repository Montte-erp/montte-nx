import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";

const FIXTURE_CSV = path.join(
   import.meta.dirname,
   "fixtures",
   "transactions-import.csv",
);

async function gotoTransactions(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/transactions`);
   await expect(
      page.getByRole("heading", { name: "Lançamentos" }),
   ).toBeVisible();
}

test("MON-887: empty state não aparece com lançamentos importados", async ({
   page,
   e2eSession,
}) => {
   await gotoTransactions(page, e2eSession);

   // força tabela vazia: filtra por termo improvável
   await page
      .getByPlaceholder("Buscar por nome, descrição ou contato...")
      .fill(`zzz-no-match-${Date.now()}`);

   await expect(page.getByText("Nenhum resultado encontrado.")).toBeVisible();

   // abre popover de importação e envia CSV
   await page.getByRole("button", { name: "Importar dados" }).click();
   await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_CSV);

   // toolbar de importação aparece com 3 linhas
   await expect(page.getByText("Importando")).toBeVisible();
   await expect(
      page.getByRole("cell", { name: "Lançamento Importado A" }),
   ).toBeVisible();
   await expect(
      page.getByRole("cell", { name: "Lançamento Importado B" }),
   ).toBeVisible();
   await expect(
      page.getByRole("cell", { name: "Lançamento Importado C" }),
   ).toBeVisible();

   // bug MON-887: empty state não deve aparecer junto com preview de importação
   await expect(
      page.getByText("Nenhum resultado encontrado."),
   ).not.toBeVisible();

   // descarta importação para não persistir nada
   await page.getByRole("button", { name: "Descartar importação" }).click();
   await page.getByRole("button", { name: "Descartar" }).click();
});
