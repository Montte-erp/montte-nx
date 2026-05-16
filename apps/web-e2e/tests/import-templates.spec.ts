import fs from "node:fs";
import type { Page } from "@playwright/test";
import { read as readXlsx, utils as xlsxUtils } from "xlsx";
import { expect, test, type E2ESession } from "../fixtures";

type TemplateCase = {
   path: string;
   heading: string;
   filenameBase: string;
   headers: string[];
};

const cases: TemplateCase[] = [
   {
      path: "categories",
      heading: "Categorias",
      filenameBase: "modelo-categorias",
      headers: ["Nome", "Tipo"],
   },
   {
      path: "transactions",
      heading: "Lançamentos",
      filenameBase: "modelo-lancamentos",
      headers: [
         "Data",
         "Nome",
         "Tipo",
         "Valor",
         "Status",
         "Vencimento",
         "Conta",
         "Cartão",
         "Categoria",
      ],
   },
   {
      path: "bank-accounts",
      heading: "Contas Bancárias",
      filenameBase: "modelo-contas-bancarias",
      headers: ["Nome", "Tipo", "Saldo Inicial"],
   },
   {
      path: "credit-cards",
      heading: "Cartões de Crédito",
      filenameBase: "modelo-cartoes-credito",
      headers: [
         "Nome",
         "Bandeira",
         "Final",
         "Limite",
         "Fechamento",
         "Vencimento",
         "Conta Bancária",
         "Status",
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

async function downloadTemplate(page: Page, label: "CSV" | "XLSX") {
   const downloadPromise = page.waitForEvent("download");
   await page.getByRole("button", { exact: true, name: label }).click();
   return downloadPromise;
}

async function expectCsvTemplate(page: Page, item: TemplateCase) {
   const download = await downloadTemplate(page, "CSV");
   expect(download.suggestedFilename()).toBe(`${item.filenameBase}.csv`);
   const filePath = await download.path();
   expect(filePath).toBeTruthy();
   if (!filePath) throw new Error("Download CSV sem arquivo temporário.");
   const content = fs.readFileSync(filePath, "utf8");
   const headerLine = content.split(/\r?\n/)[0] ?? "";
   for (const header of item.headers) {
      expect(headerLine).toContain(header);
   }
}

async function expectXlsxTemplate(page: Page, item: TemplateCase) {
   const download = await downloadTemplate(page, "XLSX");
   expect(download.suggestedFilename()).toBe(`${item.filenameBase}.xlsx`);
   const filePath = await download.path();
   expect(filePath).toBeTruthy();
   if (!filePath) throw new Error("Download XLSX sem arquivo temporário.");
   const workbook = readXlsx(fs.readFileSync(filePath), { type: "buffer" });
   const firstSheetName = workbook.SheetNames[0];
   expect(firstSheetName).toBeTruthy();
   const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
   expect(worksheet).toBeTruthy();
   if (!worksheet) throw new Error("Modelo XLSX sem planilha.");
   const rows = xlsxUtils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
   });
   const firstRow = rows[0];
   const headerRow = Array.isArray(firstRow) ? firstRow.map(String) : [];
   for (const header of item.headers) {
      expect(headerRow).toContain(header);
   }
}

test("MON-958: disponibiliza modelos CSV e XLSX nos fluxos de importação", async ({
   page,
   e2eSession,
}) => {
   for (const item of cases) {
      await gotoImportFlow(page, e2eSession, item);
      await page.getByRole("button", { name: "Importar dados" }).click();

      await expectCsvTemplate(page, item);
      await expectXlsxTemplate(page, item);
   }
});
