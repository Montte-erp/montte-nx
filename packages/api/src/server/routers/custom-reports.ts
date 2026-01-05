import {
   createCustomReport,
   type DRESnapshotData,
   deleteCustomReport,
   deleteManyCustomReports,
   findCustomReportById,
   findCustomReportsByOrganizationIdPaginated,
   generateBudgetVsActualData,
   generateCashFlowForecastData,
   generateCategoryAnalysisData,
   generateCounterpartyAnalysisData,
   generateDREFiscalData,
   generateDREGerencialData,
   generateSpendingTrendsData,
   type ReportSnapshotData,
   updateCustomReport,
} from "@packages/database/repositories/custom-report-repository";
import { APIError } from "@packages/utils/errors";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const reportTypeSchema = z.enum([
   "dre_gerencial",
   "dre_fiscal",
   "budget_vs_actual",
   "spending_trends",
   "cash_flow_forecast",
   "counterparty_analysis",
   "category_analysis",
]);

const filterConfigSchema = z
   .object({
      bankAccountIds: z.array(z.string()).optional(),
      categoryIds: z.array(z.string()).optional(),
      costCenterIds: z.array(z.string()).optional(),
      includeTransfers: z.boolean().optional(),
      tagIds: z.array(z.string()).optional(),
   })
   .optional();

const createReportSchema = z.object({
   description: z.string().optional(),
   endDate: z.string(),
   filterConfig: filterConfigSchema,
   forecastDays: z.number().min(7).max(365).optional(), // For cash_flow_forecast
   name: z.string().min(1, "Nome é obrigatório"),
   startDate: z.string(),
   type: reportTypeSchema,
});

const updateReportSchema = z.object({
   description: z.string().optional(),
   id: z.string(),
   name: z.string().min(1, "Nome é obrigatório").optional(),
});

const paginationSchema = z.object({
   limit: z.coerce.number().min(1).max(100).default(10),
   page: z.coerce.number().min(1).default(1),
   search: z.string().optional(),
   type: reportTypeSchema.optional(),
});

export const customReportRouter = router({
   create: protectedProcedure
      .input(createReportSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.session?.user.id;

         if (!userId) {
            throw APIError.unauthorized("User ID is required");
         }

         const startDate = new Date(input.startDate);
         const endDate = new Date(input.endDate);
         const filterConfig = input.filterConfig || undefined;

         let snapshotData: ReportSnapshotData;

         switch (input.type) {
            case "dre_gerencial":
               snapshotData = await generateDREGerencialData(
                  resolvedCtx.db,
                  organizationId,
                  startDate,
                  endDate,
                  filterConfig,
               );
               break;
            case "dre_fiscal":
               snapshotData = await generateDREFiscalData(
                  resolvedCtx.db,
                  organizationId,
                  startDate,
                  endDate,
                  filterConfig,
               );
               break;
            case "budget_vs_actual":
               snapshotData = await generateBudgetVsActualData(
                  resolvedCtx.db,
                  organizationId,
                  startDate,
                  endDate,
                  filterConfig,
               );
               break;
            case "spending_trends":
               snapshotData = await generateSpendingTrendsData(
                  resolvedCtx.db,
                  organizationId,
                  startDate,
                  endDate,
                  filterConfig,
               );
               break;
            case "cash_flow_forecast":
               snapshotData = await generateCashFlowForecastData(
                  resolvedCtx.db,
                  organizationId,
                  startDate,
                  input.forecastDays || 30,
                  filterConfig,
               );
               break;
            case "counterparty_analysis":
               snapshotData = await generateCounterpartyAnalysisData(
                  resolvedCtx.db,
                  organizationId,
                  startDate,
                  endDate,
                  filterConfig,
               );
               break;
            case "category_analysis":
               snapshotData = await generateCategoryAnalysisData(
                  resolvedCtx.db,
                  organizationId,
                  startDate,
                  endDate,
                  filterConfig,
               );
               break;
         }

         return createCustomReport(resolvedCtx.db, {
            createdBy: userId,
            description: input.description,
            endDate,
            filterConfig,
            id: crypto.randomUUID(),
            name: input.name,
            organizationId,
            snapshotData,
            startDate,
            type: input.type,
         });
      }),

   delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingReport = await findCustomReportById(
            resolvedCtx.db,
            input.id,
         );

         if (
            !existingReport ||
            existingReport.organizationId !== organizationId
         ) {
            throw APIError.notFound("Report not found");
         }

         return deleteCustomReport(resolvedCtx.db, input.id);
      }),

   deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.string()).min(1) }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return deleteManyCustomReports(
            resolvedCtx.db,
            input.ids,
            organizationId,
         );
      }),

   exportPdf: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const report = await findCustomReportById(resolvedCtx.db, input.id);

         if (!report || report.organizationId !== organizationId) {
            throw APIError.notFound("Report not found");
         }

         // Only DRE reports can be exported as PDF
         if (report.type !== "dre_gerencial" && report.type !== "dre_fiscal") {
            throw APIError.validation(
               "Only DRE reports can be exported as PDF",
            );
         }

         const { renderDREReport } = await import("@packages/pdf");
         const pdfBuffer = await renderDREReport({
            endDate: report.endDate.toISOString(),
            name: report.name,
            snapshotData: report.snapshotData as DRESnapshotData,
            startDate: report.startDate.toISOString(),
            type: report.type,
         });

         return {
            buffer: Buffer.from(pdfBuffer).toString("base64"),
            contentType: "application/pdf",
            filename: `${report.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
         };
      }),

   getAll: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      const result = await findCustomReportsByOrganizationIdPaginated(
         resolvedCtx.db,
         organizationId,
         { limit: 100 },
      );

      return result.reports;
   }),

   getAllPaginated: protectedProcedure
      .input(paginationSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const result = await findCustomReportsByOrganizationIdPaginated(
            resolvedCtx.db,
            organizationId,
            {
               limit: input.limit,
               page: input.page,
               search: input.search,
               type: input.type,
            },
         );

         return {
            data: result.reports,
            page: result.pagination.currentPage,
            totalCount: result.pagination.totalCount,
            totalPages: result.pagination.totalPages,
         };
      }),

   getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const report = await findCustomReportById(resolvedCtx.db, input.id);

         if (!report || report.organizationId !== organizationId) {
            throw APIError.notFound("Report not found");
         }

         return report;
      }),

   update: protectedProcedure
      .input(updateReportSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingReport = await findCustomReportById(
            resolvedCtx.db,
            input.id,
         );

         if (
            !existingReport ||
            existingReport.organizationId !== organizationId
         ) {
            throw APIError.notFound("Report not found");
         }

         return updateCustomReport(resolvedCtx.db, input.id, {
            description: input.description,
            name: input.name,
         });
      }),
});
