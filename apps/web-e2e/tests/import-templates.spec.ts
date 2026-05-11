import fs from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test, type E2ESession } from "../fixtures";

type TemplateCase = {
   path: string;
   heading: string;
   filename: string;
   headers: string[];
};

const cases: TemplateCase[] = [
   {
      path: "categories",
      heading: "Categorias",
      filename: "modelo-categorias.csv",
      headers: ["name", "type"],
   },
   {
      path: "transactions",
      heading: "Lançamentos",
      filename: "modelo-lancamentos.csv",
      headers: [
         "date",
         "name",
         "type",
         "amount",
         "status",
         "dueDate",
         "bankAccountName",
         "creditCardName",
         "categoryName",
         "contactName",
      ],
   },
   {
      path: "bank-accounts",
      heading: "Contas Bancárias",
      filename: "modelo-contas-bancarias.csv",
      headers: ["name", "type", "initialBalance"],
   },
   {
      path: "credit-cards",
      heading: "Cartões de Crédito",
      filename: "modelo-cartoes-credito.csv",
      headers: [
         "name",
         "brand",
         "last4",
         "creditLimit",
         "closingDay",
         "dueDay",
         "bankAccountId",
         "status",
      ],
   },
];

async function gotoImportFlow(
   page: Page,
   session: E2ESession,
   item: TemplateCase,
) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/${item.path}`);
   await expect(
      page.getByRole("heading", { name: item.heading }),
   ).toBeVisible();
}

test("MON-958: disponibiliza modelos CSV nos fluxos de importação", async ({
   page,
   e2eSession,
}) => {
   for (const item of cases) {
      await gotoImportFlow(page, e2eSession, item);
      await page.getByRole("button", { name: "Importar dados" }).click();

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Baixar modelo CSV" }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(item.filename);
      const filePath = await download.path();
      expect(filePath).toBeTruthy();
      const content = fs.readFileSync(filePath ?? "", "utf8");
      const headerLine = content.split(/\r?\n/)[0] ?? "";
      for (const header of item.headers) {
         expect(headerLine).toContain(header);
      }
   }
});
