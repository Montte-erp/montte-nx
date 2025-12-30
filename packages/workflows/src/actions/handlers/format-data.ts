import type { BillDigestItem, BillsDigestSummary } from "@packages/transactional/client";
import type { Consequence } from "@packages/database/schema";
import {
	type ActionHandler,
	type ActionHandlerContext,
	createActionResultWithOutput,
	createSkippedResult,
	getPreviousOutputData,
} from "../types";

type FormatDataOutput = {
	attachment: {
		filename: string;
		content: string;
		contentType: string;
	};
};

type BillsReportData = {
	bills: BillDigestItem[];
	summary: BillsDigestSummary;
	period: string;
	organizationName: string;
};

function formatBillsToCSV(
	data: BillsReportData,
	options: { includeHeaders?: boolean; delimiter?: string },
): string {
	const { includeHeaders = true, delimiter = "," } = options;
	const lines: string[] = [];

	if (includeHeaders) {
		lines.push(
			["Descrição", "Valor", "Vencimento", "Tipo", "Status"].join(delimiter),
		);
	}

	for (const bill of data.bills) {
		const status = bill.isOverdue ? "Vencido" : "Pendente";
		const type = bill.type === "expense" ? "Despesa" : "Receita";
		lines.push(
			[bill.description, bill.amount, bill.dueDate, type, status].join(
				delimiter,
			),
		);
	}

	// Add summary section
	lines.push("");
	lines.push(["Resumo", "", "", "", ""].join(delimiter));
	lines.push(
		["Total Despesas", data.summary.totalExpenseAmount, "", "", ""].join(
			delimiter,
		),
	);
	lines.push(
		["Total Receitas", data.summary.totalIncomeAmount, "", "", ""].join(
			delimiter,
		),
	);
	lines.push(
		["Pendentes", String(data.summary.totalPending), "", "", ""].join(delimiter),
	);
	lines.push(
		["Vencidos", String(data.summary.totalOverdue), "", "", ""].join(delimiter),
	);

	return lines.join("\n");
}

function formatBillsToJSON(data: BillsReportData): string {
	return JSON.stringify(
		{
			bills: data.bills,
			generatedAt: new Date().toISOString(),
			organizationName: data.organizationName,
			period: data.period,
			summary: data.summary,
		},
		null,
		2,
	);
}

function formatBillsToHTML(
	data: BillsReportData,
	options: { tableStyle?: string },
): string {
	const { tableStyle = "striped" } = options;

	const getTableStyles = () => {
		const base = `
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			border-collapse: collapse;
			width: 100%;
			margin-bottom: 20px;
		`;

		switch (tableStyle) {
			case "bordered":
				return `${base} border: 2px solid #333;`;
			case "striped":
				return base;
			default:
				return base;
		}
	};

	const getRowStyles = (index: number, isOverdue: boolean) => {
		let styles = "border-bottom: 1px solid #ddd;";
		if (isOverdue) {
			styles += "background-color: #fee2e2;";
		} else if (tableStyle === "striped" && index % 2 === 0) {
			styles += "background-color: #f9fafb;";
		}
		return styles;
	};

	const rows = data.bills
		.map((bill, index) => {
			const status = bill.isOverdue ? "Vencido" : "Pendente";
			const type = bill.type === "expense" ? "Despesa" : "Receita";
			const statusColor = bill.isOverdue ? "#dc2626" : "#16a34a";
			return `
				<tr style="${getRowStyles(index, bill.isOverdue)}">
					<td style="padding: 12px;">${bill.description}</td>
					<td style="padding: 12px; text-align: right;">${bill.amount}</td>
					<td style="padding: 12px;">${bill.dueDate}</td>
					<td style="padding: 12px;">${type}</td>
					<td style="padding: 12px; color: ${statusColor}; font-weight: 500;">${status}</td>
				</tr>
			`;
		})
		.join("");

	return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<title>Relatório de Contas - ${data.period}</title>
		</head>
		<body style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
			<h1 style="color: #111827; margin-bottom: 8px;">Relatório de Contas</h1>
			<p style="color: #6b7280; margin-bottom: 24px;">
				${data.organizationName} - ${data.period}
			</p>

			<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
				<div style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
					<div style="color: #6b7280; font-size: 14px;">Total Despesas</div>
					<div style="color: #dc2626; font-size: 24px; font-weight: 600;">${data.summary.totalExpenseAmount}</div>
				</div>
				<div style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
					<div style="color: #6b7280; font-size: 14px;">Total Receitas</div>
					<div style="color: #16a34a; font-size: 24px; font-weight: 600;">${data.summary.totalIncomeAmount}</div>
				</div>
				<div style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
					<div style="color: #6b7280; font-size: 14px;">Pendentes</div>
					<div style="color: #111827; font-size: 24px; font-weight: 600;">${data.summary.totalPending}</div>
				</div>
				<div style="background: #fee2e2; padding: 16px; border-radius: 8px;">
					<div style="color: #6b7280; font-size: 14px;">Vencidos</div>
					<div style="color: #dc2626; font-size: 24px; font-weight: 600;">${data.summary.totalOverdue}</div>
				</div>
			</div>

			<table style="${getTableStyles()}">
				<thead>
					<tr style="background: #111827; color: white;">
						<th style="padding: 12px; text-align: left;">Descrição</th>
						<th style="padding: 12px; text-align: right;">Valor</th>
						<th style="padding: 12px; text-align: left;">Vencimento</th>
						<th style="padding: 12px; text-align: left;">Tipo</th>
						<th style="padding: 12px; text-align: left;">Status</th>
					</tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>

			<p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
				Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}
			</p>
		</body>
		</html>
	`;
}

function getContentType(format: string): string {
	switch (format) {
		case "csv":
			return "text/csv";
		case "json":
			return "application/json";
		case "html_table":
			return "text/html";
		case "pdf":
			return "application/pdf";
		default:
			return "text/plain";
	}
}

function getFileExtension(format: string): string {
	switch (format) {
		case "csv":
			return "csv";
		case "json":
			return "json";
		case "html_table":
			return "html";
		case "pdf":
			return "pdf";
		default:
			return "txt";
	}
}

export const formatDataHandler: ActionHandler = {
	type: "format_data",

	async execute(consequence: Consequence, context: ActionHandlerContext) {
		const {
			outputFormat = "csv",
			fileName = "relatorio",
			csvIncludeHeaders = true,
			csvDelimiter = ",",
			htmlTableStyle = "striped",
			pdfTemplate = "bills_report",
			pdfPageSize = "A4",
		} = consequence.payload;

		// Get data from previous actions
		const previousData = getPreviousOutputData(context.previousResults);

		// Check if we have bills data (from fetch_bills_report)
		const bills = previousData.bills as BillDigestItem[] | undefined;
		const summary = previousData.summary as BillsDigestSummary | undefined;
		const period = (previousData.period as string) || "Período não especificado";
		const organizationName =
			(previousData.organizationName as string) || "Organização";

		if (!bills || bills.length === 0) {
			return createSkippedResult(
				consequence,
				"Nenhum dado disponível para formatar. Certifique-se de que há uma ação anterior que retorna dados (ex: Buscar Relatório de Contas).",
			);
		}

		if (!summary) {
			return createSkippedResult(
				consequence,
				"Dados de resumo não encontrados. Certifique-se de usar a ação 'Buscar Relatório de Contas' antes.",
			);
		}

		const reportData: BillsReportData = {
			bills,
			organizationName,
			period,
			summary,
		};

		let content: string;
		let contentBase64: string;

		try {
			switch (outputFormat) {
				case "csv":
					content = formatBillsToCSV(reportData, {
						delimiter: csvDelimiter,
						includeHeaders: csvIncludeHeaders,
					});
					contentBase64 = Buffer.from(content, "utf-8").toString("base64");
					break;

				case "json":
					content = formatBillsToJSON(reportData);
					contentBase64 = Buffer.from(content, "utf-8").toString("base64");
					break;

				case "html_table":
					content = formatBillsToHTML(reportData, {
						tableStyle: htmlTableStyle,
					});
					contentBase64 = Buffer.from(content, "utf-8").toString("base64");
					break;

				case "pdf": {
					// PDF support for bills report is not yet implemented
					// TODO: Create bills report PDF template in @packages/pdf
					return createSkippedResult(
						consequence,
						"Geração de PDF para relatório de contas ainda não implementada. Use CSV, HTML ou JSON por enquanto.",
					);
				}

				default:
					return createSkippedResult(
						consequence,
						`Formato '${outputFormat}' não suportado. Use csv, json, html_table ou pdf.`,
					);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Erro desconhecido";
			return createActionResultWithOutput(
				consequence,
				false,
				{},
				undefined,
				`Erro ao formatar dados: ${errorMessage}`,
			);
		}

		// Generate filename with template variables
		const now = new Date();
		const dateStr = now.toISOString().split("T")[0] ?? "unknown";
		const baseFileName = fileName ?? "relatorio";
		const formattedFileName = baseFileName
			.replace(/\{\{period\}\}/g, period.replace(/\s+/g, "_"))
			.replace(/\{\{date\}\}/g, dateStr)
			.replace(/\{\{timestamp\}\}/g, now.getTime().toString());

		const finalFileName = `${formattedFileName}.${getFileExtension(outputFormat)}`;

		const output: FormatDataOutput = {
			attachment: {
				content: contentBase64,
				contentType: getContentType(outputFormat),
				filename: finalFileName,
			},
		};

		return createActionResultWithOutput(
			consequence,
			true,
			output,
			{ filename: finalFileName, format: outputFormat },
		);
	},

	validate(config) {
		const errors: string[] = [];

		const validFormats = ["csv", "json", "html_table", "pdf"];
		if (config.outputFormat && !validFormats.includes(config.outputFormat)) {
			errors.push(
				`Formato inválido: ${config.outputFormat}. Use: ${validFormats.join(", ")}`,
			);
		}

		const validDelimiters = [",", ";", "\t"];
		if (config.csvDelimiter && !validDelimiters.includes(config.csvDelimiter)) {
			errors.push("Delimitador CSV inválido. Use: vírgula, ponto e vírgula ou tab");
		}

		const validStyles = ["default", "striped", "bordered"];
		if (
			config.htmlTableStyle &&
			!validStyles.includes(config.htmlTableStyle)
		) {
			errors.push(
				`Estilo de tabela inválido: ${config.htmlTableStyle}. Use: ${validStyles.join(", ")}`,
			);
		}

		return { errors, valid: errors.length === 0 };
	},
};
