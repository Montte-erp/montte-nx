import {
	createCustomReport,
	generateBudgetVsActualData,
	generateCashFlowForecastData,
	generateCategoryAnalysisData,
	generateCounterpartyAnalysisData,
	generateDREFiscalData,
	generateDREGerencialData,
	generateSpendingTrendsData,
	type ReportFilterConfig,
	type ReportSnapshotData,
	type ReportType,
} from "@packages/database/repositories/custom-report-repository";
import type { Consequence } from "@packages/database/schema";
import {
	type ActionHandler,
	type ActionHandlerContext,
	createActionResultWithOutput,
	createSkippedResult,
} from "../types";

type PeriodType = "previous_month" | "previous_week" | "current_month" | "custom";

type GenerateCustomReportPayload = {
	reportType: ReportType;
	periodType: PeriodType;
	daysBack?: number;
	forecastDays?: number;
	filterConfig?: ReportFilterConfig;
	saveReport?: boolean;
	reportName?: string;
};

function getReportTypeName(type: ReportType): string {
	const names: Record<ReportType, string> = {
		budget_vs_actual: "Orçamento vs Real",
		cash_flow_forecast: "Previsão de Fluxo de Caixa",
		category_analysis: "Análise por Categoria",
		counterparty_analysis: "Análise de Contrapartes",
		dre_fiscal: "DRE Fiscal",
		dre_gerencial: "DRE Gerencial",
		spending_trends: "Tendências de Gastos",
	};
	return names[type] || type;
}

function calculatePeriodDates(periodType: PeriodType, daysBack?: number): { startDate: Date; endDate: Date; label: string } {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	switch (periodType) {
		case "previous_month": {
			const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
			const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
			endDate.setHours(23, 59, 59, 999);
			const monthName = startDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
			return { endDate, label: `Mês anterior (${monthName})`, startDate };
		}
		case "previous_week": {
			const endDate = new Date(today);
			endDate.setDate(today.getDate() - today.getDay()); // Last Sunday
			endDate.setHours(23, 59, 59, 999);
			const startDate = new Date(endDate);
			startDate.setDate(endDate.getDate() - 6); // Monday of previous week
			startDate.setHours(0, 0, 0, 0);
			const startStr = startDate.toLocaleDateString("pt-BR");
			const endStr = endDate.toLocaleDateString("pt-BR");
			return { endDate, label: `Semana anterior (${startStr} - ${endStr})`, startDate };
		}
		case "current_month": {
			const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
			const endDate = new Date(today);
			endDate.setHours(23, 59, 59, 999);
			const monthName = startDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
			return { endDate, label: `Mês atual (${monthName})`, startDate };
		}
		case "custom": {
			const days = daysBack || 30;
			const endDate = new Date(today);
			endDate.setHours(23, 59, 59, 999);
			const startDate = new Date(today);
			startDate.setDate(today.getDate() - days);
			startDate.setHours(0, 0, 0, 0);
			return { endDate, label: `Últimos ${days} dias`, startDate };
		}
		default:
			throw new Error(`Unknown period type: ${periodType}`);
	}
}

export const generateCustomReportHandler: ActionHandler = {
	type: "generate_custom_report",

	async execute(consequence: Consequence, context: ActionHandlerContext) {
		const payload = consequence.payload as unknown as GenerateCustomReportPayload;
		const {
			reportType,
			periodType = "previous_week",
			daysBack,
			forecastDays = 30,
			filterConfig,
			saveReport = false,
			reportName,
		} = payload;

		if (!reportType) {
			return createSkippedResult(consequence, "Report type is required");
		}

		console.log(`[GenerateCustomReport] Starting: type=${reportType}, period=${periodType}, orgId=${context.organizationId}`);

		const { startDate, endDate, label: periodLabel } = calculatePeriodDates(periodType, daysBack);

		let reportData: ReportSnapshotData;

		try {
			switch (reportType) {
				case "dre_gerencial":
					reportData = await generateDREGerencialData(
						context.db,
						context.organizationId,
						startDate,
						endDate,
						filterConfig,
					);
					break;
				case "dre_fiscal":
					reportData = await generateDREFiscalData(
						context.db,
						context.organizationId,
						startDate,
						endDate,
						filterConfig,
					);
					break;
				case "budget_vs_actual":
					reportData = await generateBudgetVsActualData(
						context.db,
						context.organizationId,
						startDate,
						endDate,
						filterConfig,
					);
					break;
				case "spending_trends":
					reportData = await generateSpendingTrendsData(
						context.db,
						context.organizationId,
						startDate,
						endDate,
						filterConfig,
					);
					break;
				case "cash_flow_forecast":
					reportData = await generateCashFlowForecastData(
						context.db,
						context.organizationId,
						startDate,
						forecastDays,
						filterConfig,
					);
					break;
				case "counterparty_analysis":
					reportData = await generateCounterpartyAnalysisData(
						context.db,
						context.organizationId,
						startDate,
						endDate,
						filterConfig,
					);
					break;
				case "category_analysis":
					reportData = await generateCategoryAnalysisData(
						context.db,
						context.organizationId,
						startDate,
						endDate,
						filterConfig,
					);
					break;
				default:
					return createSkippedResult(consequence, `Unknown report type: ${reportType}`);
			}
		} catch (error) {
			console.error(`[GenerateCustomReport] Error generating report:`, error);
			return createActionResultWithOutput(
				consequence,
				false,
				{},
				undefined,
				`Failed to generate report: ${(error as Error).message}`,
			);
		}

		let savedReportId: string | undefined;

		// Optionally save the report
		if (saveReport && !context.dryRun) {
			if (!context.createdBy) {
				console.warn(`[GenerateCustomReport] Cannot save report: no createdBy available in context`);
			} else {
				try {
					const generatedName = reportName
						? reportName
							.replace("{{reportType}}", getReportTypeName(reportType))
							.replace("{{date}}", new Date().toLocaleDateString("pt-BR"))
							.replace("{{period}}", periodLabel)
						: `${getReportTypeName(reportType)} - ${periodLabel}`;

					const savedReport = await createCustomReport(context.db, {
						createdBy: context.createdBy,
						description: `Relatório gerado automaticamente pela automação`,
						endDate: endDate,
						filterConfig: filterConfig || null,
						name: generatedName,
						organizationId: context.organizationId,
						snapshotData: reportData,
						startDate: startDate,
						type: reportType,
					});

					savedReportId = savedReport.id;
					console.log(`[GenerateCustomReport] Saved report with ID: ${savedReportId}`);
				} catch (error) {
					console.error(`[GenerateCustomReport] Error saving report:`, error);
					// Continue even if saving fails - the report data is still available
				}
			}
		}

		// Return the report data for downstream actions
		return createActionResultWithOutput(
			consequence,
			true,
			{
				period: {
					endDate: endDate.toISOString(),
					label: periodLabel,
					startDate: startDate.toISOString(),
				},
				reportData,
				reportType,
				reportTypeName: getReportTypeName(reportType),
				savedReportId,
			},
			{
				period: periodLabel,
				reportType,
				saved: !!savedReportId,
			},
		);
	},

	validate(config) {
		const errors: string[] = [];
		const payload = config as unknown as GenerateCustomReportPayload;

		const validReportTypes: ReportType[] = [
			"dre_gerencial",
			"dre_fiscal",
			"budget_vs_actual",
			"spending_trends",
			"cash_flow_forecast",
			"counterparty_analysis",
		];

		if (!payload.reportType) {
			errors.push("Report type is required");
		} else if (!validReportTypes.includes(payload.reportType)) {
			errors.push(`Invalid report type: ${payload.reportType}. Valid types: ${validReportTypes.join(", ")}`);
		}

		const validPeriodTypes: PeriodType[] = ["previous_month", "previous_week", "current_month", "custom"];
		if (payload.periodType && !validPeriodTypes.includes(payload.periodType)) {
			errors.push(`Invalid period type: ${payload.periodType}. Valid types: ${validPeriodTypes.join(", ")}`);
		}

		if (payload.periodType === "custom" && !payload.daysBack) {
			errors.push("daysBack is required when periodType is 'custom'");
		}

		if (payload.reportType === "cash_flow_forecast") {
			if (payload.forecastDays !== undefined) {
				if (payload.forecastDays < 7 || payload.forecastDays > 365) {
					errors.push("forecastDays must be between 7 and 365");
				}
			}
		}

		return { errors, valid: errors.length === 0 };
	},
};
