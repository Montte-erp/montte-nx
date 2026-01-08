import { renderToBuffer } from "@react-pdf/renderer";
import {
   type BankStatementProps,
   BankStatementTemplate,
} from "./templates/bank-statement";
import { DREFiscalTemplate } from "./templates/dre-fiscal";
import { DREGerencialTemplate } from "./templates/dre-gerencial";
import {
   isSupportedPdfReportType,
   type DRESnapshotData,
   type ReportType,
   type SupportedPdfReportType,
} from "./types";

export type RenderDREReportOptions = {
   name: string;
   type: SupportedPdfReportType;
   startDate: string;
   endDate: string;
   snapshotData: DRESnapshotData;
};

export async function renderDREReport(
   options: RenderDREReportOptions,
): Promise<Buffer> {
   const { type, ...props } = options;

   const document =
      type === "dre_gerencial"
         ? DREGerencialTemplate(props)
         : DREFiscalTemplate(props);

   const buffer = await renderToBuffer(document);
   return Buffer.from(buffer);
}

export type { ReportType, SupportedPdfReportType } from "./types";
// Re-export types and utilities for PDF support checking
export { isSupportedPdfReportType } from "./types";

/**
 * Check if a report type can be rendered as PDF.
 * Returns an error message if not supported, null if supported.
 */
export function getUnsupportedReportTypeError(type: ReportType): string | null {
   if (isSupportedPdfReportType(type)) {
      return null;
   }

   const unsupportedTypes: Record<
      Exclude<ReportType, SupportedPdfReportType>,
      string
   > = {
      bank_statement: "Bank Statement",
      balance_sheet: "Balance Sheet",
      budget_vs_actual: "Budget vs Actual",
      cash_flow: "Cash Flow",
      category_breakdown: "Category Breakdown",
   };

   const typeName = unsupportedTypes[type];
   return `PDF export is not yet available for "${typeName}" reports`;
}

export type RenderBankStatementOptions = BankStatementProps;

export async function renderBankStatement(
   options: RenderBankStatementOptions,
): Promise<Buffer> {
   const document = BankStatementTemplate(options);
   const buffer = await renderToBuffer(document);
   return Buffer.from(buffer);
}

export type {
   BankStatementProps,
   BankStatementTransaction,
} from "./templates/bank-statement";
export { BankStatementTemplate } from "./templates/bank-statement";
export { DREFiscalTemplate } from "./templates/dre-fiscal";
export { DREGerencialTemplate } from "./templates/dre-gerencial";
