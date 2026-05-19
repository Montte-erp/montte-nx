import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { AgentReadClient } from "@modules/agents/tools/registry";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

const reportTypeSchema = z.enum([
   "profit_and_loss",
   "cash_flow",
   "expenses_by_cost_center",
   "expenses_by_category",
   "aging",
]);

const generateFinancialReportInputSchema = z
   .object({
      reportType: reportTypeSchema,
      startDate: isoDate,
      endDate: isoDate,
      status: z.enum(["paid", "pending", "all"]).default("paid"),
      type: z.enum(["income", "expense"]).optional(),
      categoryId: uuid.optional(),
      costCenterId: uuid.optional(),
      bankAccountId: uuid.optional(),
   })
   .refine(
      (value) =>
         new Date(value.startDate).getTime() <=
         new Date(value.endDate).getTime(),
      {
         path: ["endDate"],
         message: "A data final deve ser maior ou igual à data inicial.",
      },
   );

const generateFinancialReportOutputSchema = z.object({
   reportType: reportTypeSchema,
   result: z.json(),
});

interface ReportReadToolDeps {
   client: AgentReadClient;
}

export function buildReportReadTools({ client }: ReportReadToolDeps) {
   return [
      toolDefinition({
         name: "generate_financial_report",
         description:
            "Gera relatórios financeiros de leitura: DRE, fluxo de caixa, despesas por Centro de Custo, despesas por categoria e aging.",
         inputSchema: generateFinancialReportInputSchema,
         outputSchema: generateFinancialReportOutputSchema,
      }).server(async (input) => {
         const baseInput = {
            dateFrom: input.startDate,
            dateTo: input.endDate,
            status: input.status,
            categoryId: input.categoryId,
            tagId: input.costCenterId,
            bankAccountId: input.bankAccountId,
         };
         const result = await (async () => {
            switch (input.reportType) {
               case "profit_and_loss":
                  return client.reports.profitAndLoss({
                     ...baseInput,
                     dreOnly: true,
                  });
               case "cash_flow":
                  return client.reports.cashFlow(baseInput);
               case "expenses_by_cost_center":
                  return client.reports.expensesByCostCenter(baseInput);
               case "expenses_by_category":
                  return client.reports.expensesByCategory({
                     ...baseInput,
                     depth: "group",
                     minAmount: 0,
                  });
               case "aging":
                  return client.reports.aging({
                     dateFrom: input.startDate,
                     dateTo: input.endDate,
                     type: input.type ?? "income",
                     ...(input.status === "paid"
                        ? { status: "settled" }
                        : input.status === "pending"
                          ? { status: "open" }
                          : {}),
                     categoryId: input.categoryId,
                     tagId: input.costCenterId,
                  });
            }
         })();

         return {
            reportType: input.reportType,
            result,
         };
      }),
   ];
}
