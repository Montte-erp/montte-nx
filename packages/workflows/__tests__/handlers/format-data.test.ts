import { describe, expect, it } from "bun:test";
import { formatDataHandler } from "../../src/actions/handlers/format-data";
import { createTestConsequence } from "../helpers/fixtures";
import { createMockContext } from "../helpers/mock-context";
import type { ConsequenceExecutionResult } from "../../src/types/actions";

const mockBillsData = {
   bills: [
      {
         description: "Electricity Bill",
         amount: "150.00",
         dueDate: "2024-01-15",
         type: "expense" as const,
         isOverdue: false,
      },
      {
         description: "Water Bill",
         amount: "50.00",
         dueDate: "2024-01-10",
         type: "expense" as const,
         isOverdue: true,
      },
   ],
   summary: {
      totalExpenseAmount: "200.00",
      totalIncomeAmount: "0.00",
      totalPending: 1,
      totalOverdue: 1,
   },
   period: "Janeiro 2024",
   organizationName: "Test Org",
};

function createMockPreviousResults(data = mockBillsData): ConsequenceExecutionResult[] {
   return [
      {
         type: "fetch_bills_report",
         success: true,
         outputData: data,
         consequenceIndex: 0,
      },
   ];
}

describe("formatDataHandler", () => {
   describe("execute", () => {
      it("should format data to CSV with default options", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "csv" },
         });
         const context = createMockContext({
            eventData: { id: "tx-123" },
         });
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.type).toBe("format_data");
         expect(result.outputData?.attachment).toBeDefined();
         const attachment = result.outputData?.attachment as { filename: string; contentType: string; content: string };
         expect(attachment.filename).toMatch(/\.csv$/);
         expect(attachment.contentType).toBe("text/csv");
         expect(attachment.content).toBeDefined(); // Base64 encoded
      });

      it("should format data to CSV without headers", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "csv", csvIncludeHeaders: false },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         const attachment = result.outputData?.attachment as { content: string };
         const csvContent = Buffer.from(attachment.content, "base64").toString("utf-8");
         expect(csvContent).not.toContain("Descrição,Valor");
      });

      it("should format data to CSV with semicolon delimiter", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "csv", csvDelimiter: ";" },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         const attachment = result.outputData?.attachment as { content: string };
         const csvContent = Buffer.from(attachment.content, "base64").toString("utf-8");
         expect(csvContent).toContain(";");
      });

      it("should format data to JSON", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "json" },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         const attachment = result.outputData?.attachment as { filename: string; contentType: string; content: string };
         expect(attachment.filename).toMatch(/\.json$/);
         expect(attachment.contentType).toBe("application/json");

         const jsonContent = Buffer.from(attachment.content, "base64").toString("utf-8");
         const parsed = JSON.parse(jsonContent);
         expect(parsed.bills).toBeDefined();
         expect(parsed.summary).toBeDefined();
      });

      it("should format data to HTML table", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "html_table" },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         const attachment = result.outputData?.attachment as { filename: string; contentType: string; content: string };
         expect(attachment.filename).toMatch(/\.html$/);
         expect(attachment.contentType).toBe("text/html");

         const htmlContent = Buffer.from(attachment.content, "base64").toString("utf-8");
         expect(htmlContent).toContain("<table");
         expect(htmlContent).toContain("Electricity Bill");
      });

      it("should format HTML table with bordered style", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "html_table", htmlTableStyle: "bordered" },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         const attachment = result.outputData?.attachment as { content: string };
         const htmlContent = Buffer.from(attachment.content, "base64").toString("utf-8");
         expect(htmlContent).toContain("border:");
      });

      it("should use custom filename with period template", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "csv", fileName: "contas_{{period}}" },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         const attachment = result.outputData?.attachment as { filename: string };
         expect(attachment.filename).toContain("Janeiro_2024");
         expect(attachment.filename).toMatch(/\.csv$/);
      });

      it("should skip when PDF format requested (not implemented)", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "pdf" },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("PDF");
      });

      it("should skip when no bills data available", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "csv" },
         });
         const context = createMockContext();
         context.previousResults = [];

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("Nenhum dado disponível");
      });

      it("should skip when bills array is empty", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "csv" },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults({ ...mockBillsData, bills: [] });

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
      });

      it("should skip when summary is missing", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            payload: { outputFormat: "csv" },
         });
         const context = createMockContext();
         context.previousResults = [
            {
               type: "fetch_bills_report",
               success: true,
               outputData: { bills: mockBillsData.bills, period: "Test" },
               consequenceIndex: 0,
            },
         ];

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("resumo não encontrados");
      });

      it("should skip for unsupported format", async () => {
         const consequence = createTestConsequence({
            type: "format_data",
            // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
            payload: { outputFormat: "xml" as any },
         });
         const context = createMockContext();
         context.previousResults = createMockPreviousResults();

         const result = await formatDataHandler.execute(consequence, context);

         expect(result.success).toBe(true);
         expect(result.skipped).toBe(true);
         expect(result.skipReason).toContain("xml");
      });
   });

   describe("validate", () => {
      it("should return valid for valid CSV format", () => {
         const result = formatDataHandler.validate?.({ outputFormat: "csv" });
         expect(result?.valid).toBe(true);
         expect(result?.errors).toEqual([]);
      });

      it("should return valid for valid JSON format", () => {
         const result = formatDataHandler.validate?.({ outputFormat: "json" });
         expect(result?.valid).toBe(true);
      });

      it("should return valid for valid HTML format", () => {
         const result = formatDataHandler.validate?.({ outputFormat: "html_table" });
         expect(result?.valid).toBe(true);
      });

      it("should return valid for valid PDF format", () => {
         const result = formatDataHandler.validate?.({ outputFormat: "pdf" });
         expect(result?.valid).toBe(true);
      });

      it("should return valid for no format (uses default)", () => {
         const result = formatDataHandler.validate?.({});
         expect(result?.valid).toBe(true);
      });

      it("should return invalid for unsupported format", () => {
         // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
         const result = formatDataHandler.validate?.({ outputFormat: "xml" as any });
         expect(result?.valid).toBe(false);
         expect(result?.errors[0]).toContain("Formato inválido");
      });

      it("should return invalid for invalid CSV delimiter", () => {
         // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
         const result = formatDataHandler.validate?.({ outputFormat: "csv", csvDelimiter: "|" as any });
         expect(result?.valid).toBe(false);
         expect(result?.errors[0]).toContain("Delimitador CSV inválido");
      });

      it("should return valid for valid CSV delimiters", () => {
         const delimiters = [",", ";", "\t"] as const;
         for (const delimiter of delimiters) {
            const result = formatDataHandler.validate?.({ outputFormat: "csv", csvDelimiter: delimiter });
            expect(result?.valid).toBe(true);
         }
      });

      it("should return invalid for invalid HTML table style", () => {
         // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
         const result = formatDataHandler.validate?.({ outputFormat: "html_table", htmlTableStyle: "fancy" as any });
         expect(result?.valid).toBe(false);
         expect(result?.errors[0]).toContain("Estilo de tabela inválido");
      });

      it("should return valid for valid HTML table styles", () => {
         const styles = ["default", "striped", "bordered"] as const;
         for (const style of styles) {
            const result = formatDataHandler.validate?.({ outputFormat: "html_table", htmlTableStyle: style });
            expect(result?.valid).toBe(true);
         }
      });
   });
});
