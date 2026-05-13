import type { Page } from "@playwright/test";
import { utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import { expect, test, type E2ESession } from "../fixtures";

test.describe.configure({ mode: "serial" });

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

async function gotoTransactions(page: Page, session: E2ESession) {
   await page.goto(`/${session.orgSlug}/${session.teamSlug}/transactions`);
   await expect(
      page.getByRole("heading", { name: "Lançamentos" }),
   ).toBeVisible();
}

function buildXlsx(rows: (string | number | Date)[][]): Buffer {
   const wb = xlsxUtils.book_new();
   const ws = xlsxUtils.aoa_to_sheet(rows, { cellDates: true });
   xlsxUtils.book_append_sheet(wb, ws, "Lançamentos");
   return xlsxWrite(wb, { type: "buffer", bookType: "xlsx" });
}

test("MON-994: XLSX import renders date as dd/mm/yyyy (não undefined/undefined/45779)", async ({
   page,
   e2eSession,
}) => {
   const s = stamp();
   const txName = `MON994 Lan ${s}`;
   const buffer = buildXlsx([
      ["Nome", "Data", "Valor", "Tipo"],
      [txName, new Date(2026, 0, 15, 12), 100, "Despesa"],
   ]);

   await gotoTransactions(page, e2eSession);
   await page.getByRole("button", { name: "Importar dados" }).click();
   await page.locator('input[type="file"]').first().setInputFiles({
      name: "lancamentos.xlsx",
      mimeType:
         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
   });
   await expect(page.getByText("Importando")).toBeVisible();

   const nameField = page.getByRole("textbox", { name: "Nome" });
   await expect(nameField).toHaveValue(txName, { timeout: 30_000 });

   const row = page.getByRole("row").filter({ has: nameField });
   await expect(row).toBeVisible();

   const text = (await row.textContent()) ?? "";
   expect(text, "data não deve conter 'undefined'").not.toContain("undefined");
   expect(text, "data não deve ser 'Invalid Date'").not.toContain(
      "Invalid Date",
   );
   expect(
      text,
      "data não deve aparecer como serial numérico bruto",
   ).not.toMatch(/\b4[0-9]{4}\b/);
   expect(text, "data deve aparecer em dd/mm/yyyy").toContain("15/01/2026");
});
