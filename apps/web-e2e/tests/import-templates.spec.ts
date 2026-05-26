import fs from "node:fs";
import type { Page } from "@playwright/test";
import { read as readXlsx, utils as xlsxUtils, write as writeXlsx } from "xlsx";
import { expect, test, type E2ESession } from "../fixtures";
import {
   deletePartyById,
   findPartiesByDocument,
   findPartyByName,
   findTeamByOrgAndSlug,
} from "../helpers/db";

type TemplateCase = {
   path: string;
   heading: string;
   filenameBase: string;
   headers: string[];
};

const createdPartyIds: string[] = [];
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

function cpfDigit(values: string, weights: readonly number[]) {
   const total = values
      .split("")
      .reduce(
         (acc, digit, index) => acc + Number(digit) * (weights[index] ?? 0),
         0,
      );
   const remainder = total % 11;
   return remainder < 2 ? 0 : 11 - remainder;
}

function generateCpf() {
   const body = String(Math.floor(100_000_000 + Math.random() * 899_999_999));
   const first = cpfDigit(body, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
   const second = cpfDigit(`${body}${first}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
   return `${body}${first}${second}`;
}

const customersTemplateCase: TemplateCase = {
   path: "customers",
   heading: "Clientes",
   filenameBase: "modelo-relacionamentos",
   headers: ["Tipo", "Nome", "CPF/CNPJ", "E-mail", "Telefone"],
};

const suppliersTemplateCase: TemplateCase = {
   path: "suppliers",
   heading: "Fornecedores",
   filenameBase: "modelo-relacionamentos",
   headers: ["Tipo", "Nome", "CPF/CNPJ", "E-mail", "Telefone"],
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
   customersTemplateCase,
   suppliersTemplateCase,
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

async function uploadCsv(page: Page, filename: string, csv: string) {
   await page.getByRole("button", { name: "Importar dados" }).click();
   await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
         name: filename,
         mimeType: "text/csv",
         buffer: Buffer.from(csv, "utf8"),
      });
   await expect(page.getByText("Importando")).toBeVisible();
}

async function uploadXlsx(
   page: Page,
   filename: string,
   rows: Record<string, string>[],
) {
   await page.getByRole("button", { name: "Importar dados" }).click();
   const worksheet = xlsxUtils.json_to_sheet(rows, {
      header: ["Tipo", "Nome", "CPF/CNPJ", "E-mail", "Telefone"],
   });
   const workbook = xlsxUtils.book_new();
   xlsxUtils.book_append_sheet(workbook, worksheet, "Modelo");
   await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
         name: filename,
         mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
         buffer: Buffer.from(writeXlsx(workbook, { type: "buffer" })),
      });
   await expect(page.getByText("Importando")).toBeVisible();
}

async function rememberParty(session: E2ESession, name: string) {
   const team = await findTeamByOrgAndSlug(session.orgSlug, session.teamSlug);
   if (!team) return;
   const party = await findPartyByName(team.id, name);
   if (party) createdPartyIds.push(party.id);
}

async function expectRelationshipRow(page: Page, name: string) {
   await page.getByPlaceholder("Buscar por nome ou CPF/CNPJ...").fill(name);
   await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
}

test.afterEach(async ({ e2eSession }) => {
   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   if (!team) return;
   for (const id of createdPartyIds.splice(0)) {
      await deletePartyById(team.id, id);
   }
});

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

test("MON-958: CSV importado em Clientes cria cliente", async ({
   page,
   e2eSession,
}) => {
   const name = `Cliente Import E2E ${stamp()}`;
   await gotoImportFlow(page, e2eSession, customersTemplateCase);
   await uploadCsv(
      page,
      "clientes.csv",
      `Tipo,Nome,CPF/CNPJ,E-mail,Telefone\nEmpresa,${name},,cliente-import@email.com,(11) 99999-9999\n`,
   );

   await page.getByRole("button", { name: "Salvar importação" }).click();
   await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Salvar" })
      .click();
   await expect(
      page.getByText(/1 relacionamento\(s\) importado\(s\)/),
   ).toBeVisible();
   await rememberParty(e2eSession, name);
   await expectRelationshipRow(page, name);
});

test("MON-958: XLSX importado em Fornecedores cria fornecedor", async ({
   page,
   e2eSession,
}) => {
   const name = `Fornecedor Import E2E ${stamp()}`;
   await gotoImportFlow(page, e2eSession, suppliersTemplateCase);
   await uploadXlsx(page, "fornecedores.xlsx", [
      {
         Tipo: "Empresa",
         Nome: name,
         "CPF/CNPJ": "",
         "E-mail": "fornecedor-import@email.com",
         Telefone: "(11) 98888-8888",
      },
   ]);

   await page.getByRole("button", { name: "Salvar importação" }).click();
   await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Salvar" })
      .click();
   await expect(
      page.getByText(/1 relacionamento\(s\) importado\(s\)/),
   ).toBeVisible();
   await rememberParty(e2eSession, name);
   await expectRelationshipRow(page, name);
});

test("MON-958: documento duplicado não cria segundo relacionamento", async ({
   page,
   e2eSession,
}) => {
   const name = `Cliente Duplicado E2E ${stamp()}`;
   const documentNumber = generateCpf();
   await gotoImportFlow(page, e2eSession, customersTemplateCase);
   await uploadCsv(
      page,
      "clientes-duplicados.csv",
      `Tipo,Nome,CPF/CNPJ,E-mail,Telefone\nPessoa física,${name},${documentNumber},duplicado@email.com,(11) 99999-9999\nPessoa física,${name} 2,${documentNumber},duplicado2@email.com,(11) 98888-8888\n`,
   );

   await page.getByRole("button", { name: "Salvar importação" }).click();
   await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Salvar" })
      .click();
   await expect(
      page.getByText(/1 relacionamento\(s\) importado\(s\)/),
   ).toBeVisible();

   const team = await findTeamByOrgAndSlug(
      e2eSession.orgSlug,
      e2eSession.teamSlug,
   );
   expect(team).toBeTruthy();
   if (!team) throw new Error("Time de E2E não encontrado.");
   const parties = await findPartiesByDocument(
      team.id,
      "customer",
      documentNumber,
   );
   for (const party of parties) createdPartyIds.push(party.id);
   expect(parties).toHaveLength(1);
});
