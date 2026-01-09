/**
 * Seed script for automation templates
 *
 * This script seeds system automation templates into the database.
 * Templates provide pre-built workflows that users can activate.
 *
 * Usage:
 *   bun run scripts/seed-automation-templates.ts check --env local
 *   bun run scripts/seed-automation-templates.ts run --env local --dry-run
 *   bun run scripts/seed-automation-templates.ts run --env local
 */

import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { ConditionGroup } from "@f-o-t/rules-engine";
import { upsertSystemTemplate } from "../packages/database/src/repositories/automation-template-repository";
import type { TemplateCategory } from "../packages/database/src/schemas/automation-templates";
import type {
	Consequence,
	FlowData,
	TriggerConfig,
	TriggerType,
} from "../packages/database/src/schemas/automations";
import * as schema from "../packages/database/src/schema";

const program = new Command();

const colors = {
	blue: chalk.blue,
	cyan: chalk.cyan,
	green: chalk.green,
	red: chalk.red,
	yellow: chalk.yellow,
};

function getEnvFilePath(env: string): string {
	const packageDir = path.join(process.cwd(), "packages", "database");
	const possibleFiles = [`.env.${env}`, ".env.local", ".env"];

	for (const file of possibleFiles) {
		const filePath = path.join(packageDir, file);
		if (fs.existsSync(filePath)) {
			return filePath;
		}
	}

	throw new Error(`No environment file found for ${env}`);
}

// ============================================
// Flow Data Generation Helpers
// ============================================

type NodeBase = {
	id: string;
	position: { x: number; y: number };
	type: "trigger" | "action" | "condition";
};

type TriggerNode = NodeBase & {
	type: "trigger";
	data: {
		label: string;
		triggerType: TriggerType;
		config: TriggerConfig;
	};
};

type ActionNode = NodeBase & {
	type: "action";
	data: {
		label: string;
		actionType: string;
		config: Record<string, unknown>;
	};
};

type AutomationNode = TriggerNode | ActionNode;

type AutomationEdge = {
	id: string;
	source: string;
	target: string;
	sourceHandle: string;
	targetHandle: string;
};

function generateFlowData(
	triggerType: TriggerType,
	triggerConfig: TriggerConfig,
	actions: Array<{
		type: string;
		label: string;
		config: Record<string, unknown>;
	}>,
): FlowData {
	const nodes: AutomationNode[] = [];
	const edges: AutomationEdge[] = [];

	// Create trigger node
	const triggerId = "trigger-template-1";
	nodes.push({
		id: triggerId,
		position: { x: 250, y: 0 },
		type: "trigger",
		data: {
			label: "Gatilho",
			triggerType,
			config: triggerConfig,
		},
	});

	let lastNodeId = triggerId;
	let yPosition = 150;

	// Create action nodes
	actions.forEach((action, index) => {
		const actionId = `action-template-${index + 1}`;
		nodes.push({
			id: actionId,
			position: { x: 250, y: yPosition },
			type: "action",
			data: {
				label: action.label,
				actionType: action.type,
				config: action.config,
			},
		});

		edges.push({
			id: `edge-${lastNodeId}-${actionId}`,
			source: lastNodeId,
			target: actionId,
			sourceHandle: "bottom",
			targetHandle: "top",
		});

		lastNodeId = actionId;
		yPosition += 150;
	});

	return {
		nodes: nodes as unknown[],
		edges: edges as unknown[],
		viewport: { x: 0, y: 0, zoom: 1 },
	};
}

// ============================================
// System Templates
// ============================================

type SystemTemplate = {
	name: string;
	description: string;
	category: TemplateCategory;
	icon: string;
	tags: string[];
	triggerType: TriggerType;
	triggerConfig: TriggerConfig;
	conditions: ConditionGroup;
	consequences: Consequence[];
	flowData: FlowData;
};

const SYSTEM_TEMPLATES: SystemTemplate[] = [
	// ============================================
	// TRANSACTION PROCESSING SUITE
	// ============================================

	// Auto-Categorize Subscription Services
	{
		name: "Categorizar Assinaturas Automaticamente",
		description:
			"Categoriza automaticamente transacoes de servicos de streaming e assinaturas como Netflix, Spotify, Disney+, etc.",
		category: "transaction_processing",
		icon: "Tv",
		tags: ["assinatura", "categorizacao", "automatico", "streaming"],
		triggerType: "transaction.created",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [
				{
					id: "subscription-keywords",
					type: "string",
					field: "description",
					operator: "contains_any",
					value: [
						"NETFLIX",
						"SPOTIFY",
						"DISNEY",
						"AMAZON PRIME",
						"YOUTUBE",
						"HBO",
						"APPLE",
						"DEEZER",
						"GLOBOPLAY",
						"PARAMOUNT",
						"STAR+",
						"CRUNCHYROLL",
					],
					options: { caseSensitive: false },
				},
			],
		},
		consequences: [
			{
				type: "set_category",
				payload: {
					// Note: Category ID will be resolved at activation time
					categoryId: "{{entertainment_category}}",
				},
			},
		],
		flowData: generateFlowData(
			"transaction.created",
			{} as TriggerConfig,
			[
				{
					type: "set_category",
					label: "Definir Categoria (Entretenimento)",
					config: { categoryId: "{{entertainment_category}}" },
				},
			],
		),
	},

	// Auto-Categorize by Merchant Pattern (Transport)
	{
		name: "Categorizar Transporte Automaticamente",
		description:
			"Categoriza automaticamente transacoes de transporte como Uber, 99, Lyft, etc.",
		category: "transaction_processing",
		icon: "Car",
		tags: ["transporte", "categorizacao", "automatico", "uber"],
		triggerType: "transaction.created",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [
				{
					id: "transport-keywords",
					type: "string",
					field: "description",
					operator: "contains_any",
					value: [
						"UBER",
						"99",
						"LYFT",
						"CABIFY",
						"INDRIVER",
						"TAXI",
						"ESTACIONAMENTO",
						"PARKING",
						"COMBUSTIVEL",
						"GASOLINA",
						"POSTO",
						"SHELL",
						"IPIRANGA",
						"BR DISTRIBUIDORA",
					],
					options: { caseSensitive: false },
				},
			],
		},
		consequences: [
			{
				type: "set_category",
				payload: {
					categoryId: "{{transport_category}}",
				},
			},
		],
		flowData: generateFlowData(
			"transaction.created",
			{} as TriggerConfig,
			[
				{
					type: "set_category",
					label: "Definir Categoria (Transporte)",
					config: { categoryId: "{{transport_category}}" },
				},
			],
		),
	},

	// Flag Large Transactions for Review
	{
		name: "Alertar Transacoes de Alto Valor",
		description:
			"Marca e notifica sobre transacoes com valor acima de R$ 1.000 para revisao",
		category: "transaction_processing",
		icon: "AlertTriangle",
		tags: ["alerta", "revisao", "grande-valor", "notificacao"],
		triggerType: "transaction.created",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [
				{
					id: "high-value",
					type: "number",
					field: "amount",
					operator: "gt",
					value: 1000,
				},
			],
		},
		consequences: [
			{
				type: "add_tag",
				payload: {
					tagIds: ["{{review_tag}}"],
				},
			},
			{
				type: "send_push_notification",
				payload: {
					title: "Transacao de Alto Valor",
					body: "Uma transacao acima de R$ 1.000 foi registrada e precisa de revisao",
				},
			},
		],
		flowData: generateFlowData(
			"transaction.created",
			{} as TriggerConfig,
			[
				{
					type: "add_tag",
					label: "Adicionar Tag (Revisao)",
					config: { tagIds: ["{{review_tag}}"] },
				},
				{
					type: "send_push_notification",
					label: "Enviar Notificacao",
					config: {
						title: "Transacao de Alto Valor",
						body: "Uma transacao acima de R$ 1.000 foi registrada e precisa de revisao",
					},
				},
			],
		),
	},

	// Auto-Tag Recurring Income
	{
		name: "Identificar Receita Recorrente",
		description:
			"Marca automaticamente transacoes de receita que parecem ser salario ou pagamentos recorrentes",
		category: "transaction_processing",
		icon: "Wallet",
		tags: ["receita", "recorrente", "salario", "automatico"],
		triggerType: "transaction.created",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [
				{
					id: "is-income",
					type: "string",
					field: "type",
					operator: "eq",
					value: "income",
				},
				{
					id: "salary-keywords",
					type: "string",
					field: "description",
					operator: "contains_any",
					value: [
						"SALARIO",
						"SALARY",
						"PAGAMENTO",
						"DEPOSITO",
						"FOLHA",
						"REMUNERACAO",
						"PRO-LABORE",
						"PROLABORE",
						"ADIANTAMENTO",
						"13",
						"FERIAS",
						"BONIFICACAO",
						"PLR",
					],
					options: { caseSensitive: false },
				},
			],
		},
		consequences: [
			{
				type: "add_tag",
				payload: {
					tagIds: ["{{recurring_income_tag}}"],
				},
			},
		],
		flowData: generateFlowData(
			"transaction.created",
			{} as TriggerConfig,
			[
				{
					type: "add_tag",
					label: "Adicionar Tag (Receita Recorrente)",
					config: { tagIds: ["{{recurring_income_tag}}"] },
				},
			],
		),
	},

	// Mark Potential Transfers
	{
		name: "Identificar Possiveis Transferencias",
		description:
			"Marca transacoes que parecem ser transferencias entre contas para revisao",
		category: "transaction_processing",
		icon: "ArrowLeftRight",
		tags: ["transferencia", "identificacao", "pix", "ted"],
		triggerType: "transaction.created",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [
				{
					id: "transfer-keywords",
					type: "string",
					field: "description",
					operator: "contains_any",
					value: [
						"TRANSFERENCIA",
						"TRANSFER",
						"TRF",
						"PIX",
						"TED",
						"DOC",
						"TRANSF",
						"P2P",
					],
					options: { caseSensitive: false },
				},
			],
		},
		consequences: [
			{
				type: "add_tag",
				payload: {
					tagIds: ["{{potential_transfer_tag}}"],
				},
			},
		],
		flowData: generateFlowData(
			"transaction.created",
			{} as TriggerConfig,
			[
				{
					type: "add_tag",
					label: "Adicionar Tag (Transferencia Potencial)",
					config: { tagIds: ["{{potential_transfer_tag}}"] },
				},
			],
		),
	},

	// ============================================
	// BILL MANAGEMENT SUITE (Existing)
	// ============================================

	// Weekly Bills Digest
	{
		name: "Resumo Semanal de Contas",
		description:
			"Envia um e-mail semanal com o resumo das contas a pagar e receber dos proximos dias",
		category: "bill_management",
		icon: "ClipboardList",
		tags: ["contas", "semanal", "email", "relatorio"],
		triggerType: "schedule.weekly",
		triggerConfig: {
			time: "09:00",
			timezone: "America/Sao_Paulo",
			dayOfWeek: 1, // Monday
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "fetch_bills_report",
				payload: {
					includePending: true,
					includeOverdue: true,
					daysAhead: 7,
					billTypes: ["expense", "income"],
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					useTemplate: "bills_digest",
				},
			},
		],
		flowData: generateFlowData(
			"schedule.weekly",
			{
				time: "09:00",
				timezone: "America/Sao_Paulo",
				dayOfWeek: 1,
			} as TriggerConfig,
			[
				{
					type: "fetch_bills_report",
					label: "Buscar Relatorio de Contas",
					config: {
						includePending: true,
						includeOverdue: true,
						daysAhead: 7,
						billTypes: ["expense", "income"],
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail",
					config: {
						to: "owner",
						useTemplate: "bills_digest",
					},
				},
			],
		),
	},

	// Daily Overdue Bills Alert
	{
		name: "Alerta Diario de Contas Vencidas",
		description: "Envia uma notificacao diaria se houver contas vencidas",
		category: "bill_management",
		icon: "Bell",
		tags: ["contas", "vencidas", "diario", "alerta"],
		triggerType: "schedule.daily",
		triggerConfig: {
			time: "08:00",
			timezone: "America/Sao_Paulo",
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "fetch_bills_report",
				payload: {
					includePending: false,
					includeOverdue: true,
					daysAhead: 0,
					billTypes: ["expense"],
				},
			},
			{
				type: "send_push_notification",
				payload: {
					title: "Contas Vencidas",
					body: "Voce tem contas vencidas que precisam de atencao",
				},
			},
		],
		flowData: generateFlowData(
			"schedule.daily",
			{
				time: "08:00",
				timezone: "America/Sao_Paulo",
			} as TriggerConfig,
			[
				{
					type: "fetch_bills_report",
					label: "Buscar Contas Vencidas",
					config: {
						includePending: false,
						includeOverdue: true,
						daysAhead: 0,
						billTypes: ["expense"],
					},
				},
				{
					type: "send_push_notification",
					label: "Enviar Notificacao",
					config: {
						title: "Contas Vencidas",
						body: "Voce tem contas vencidas que precisam de atencao",
					},
				},
			],
		),
	},

	// Weekly Bills Report with CSV Attachment
	{
		name: "Relatorio Semanal em CSV",
		description:
			"Gera e envia um relatorio CSV das contas da semana por e-mail",
		category: "reporting",
		icon: "FileBarChart",
		tags: ["relatorio", "csv", "semanal", "email"],
		triggerType: "schedule.weekly",
		triggerConfig: {
			time: "18:00",
			timezone: "America/Sao_Paulo",
			dayOfWeek: 5, // Friday
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "fetch_bills_report",
				payload: {
					includePending: true,
					includeOverdue: true,
					daysAhead: 7,
					billTypes: ["expense", "income"],
				},
			},
			{
				type: "format_data",
				payload: {
					outputFormat: "csv",
					fileName: "relatorio_contas_{{date}}",
					csvIncludeHeaders: true,
					csvDelimiter: ";",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Relatorio Semanal de Contas",
					body: "<p>Segue em anexo o relatorio semanal de contas.</p><p>Este e-mail foi gerado automaticamente.</p>",
					includeAttachment: true,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.weekly",
			{
				time: "18:00",
				timezone: "America/Sao_Paulo",
				dayOfWeek: 5,
			} as TriggerConfig,
			[
				{
					type: "fetch_bills_report",
					label: "Buscar Relatorio de Contas",
					config: {
						includePending: true,
						includeOverdue: true,
						daysAhead: 7,
						billTypes: ["expense", "income"],
					},
				},
				{
					type: "format_data",
					label: "Formatar como CSV",
					config: {
						outputFormat: "csv",
						fileName: "relatorio_contas_{{date}}",
						csvIncludeHeaders: true,
						csvDelimiter: ";",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail com Anexo",
					config: {
						to: "owner",
						subject: "Relatorio Semanal de Contas",
						body: "<p>Segue em anexo o relatorio semanal de contas.</p><p>Este e-mail foi gerado automaticamente.</p>",
						includeAttachment: true,
					},
				},
			],
		),
	},

	// ============================================
	// REPORTS SUITE (Custom Reports)
	// ============================================

	// Weekly DRE Report (Income Statement)
	{
		name: "DRE Gerencial Semanal",
		description:
			"Gera e envia o DRE (Demonstrativo de Resultados) gerencial da semana anterior por e-mail",
		category: "reporting",
		icon: "BarChart3",
		tags: ["dre", "semanal", "relatorio", "receita-despesa"],
		triggerType: "schedule.weekly",
		triggerConfig: {
			time: "08:00",
			timezone: "America/Sao_Paulo",
			dayOfWeek: 1, // Monday
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "generate_custom_report",
				payload: {
					reportType: "dre_gerencial",
					periodType: "previous_week",
					saveReport: false,
				},
			},
			{
				type: "format_data",
				payload: {
					outputFormat: "html_table",
					htmlTableStyle: "striped",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "DRE Gerencial - Semana Anterior",
					body: "<p>Segue o Demonstrativo de Resultados da semana anterior.</p>",
					includeAttachment: false,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.weekly",
			{
				time: "08:00",
				timezone: "America/Sao_Paulo",
				dayOfWeek: 1,
			} as TriggerConfig,
			[
				{
					type: "generate_custom_report",
					label: "Gerar DRE Gerencial",
					config: {
						reportType: "dre_gerencial",
						periodType: "previous_week",
						saveReport: false,
					},
				},
				{
					type: "format_data",
					label: "Formatar como Tabela HTML",
					config: {
						outputFormat: "html_table",
						htmlTableStyle: "striped",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail",
					config: {
						to: "owner",
						subject: "DRE Gerencial - Semana Anterior",
						body: "<p>Segue o Demonstrativo de Resultados da semana anterior.</p>",
					},
				},
			],
		),
	},

	// Monthly Spending Trends Report
	{
		name: "Relatorio Mensal de Tendencias de Gastos",
		description:
			"Analisa tendencias de gastos do mes anterior com comparativo ano a ano",
		category: "reporting",
		icon: "TrendingUp",
		tags: ["mensal", "tendencias", "gastos", "comparativo"],
		triggerType: "schedule.custom",
		triggerConfig: {
			time: "09:00",
			timezone: "America/Sao_Paulo",
			cronPattern: "0 9 1 * *", // 1st of every month at 09:00
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "generate_custom_report",
				payload: {
					reportType: "spending_trends",
					periodType: "previous_month",
					saveReport: true,
					reportName: "Tendencias de Gastos - {{period}}",
				},
			},
			{
				type: "format_data",
				payload: {
					outputFormat: "html_table",
					htmlTableStyle: "striped",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Analise de Tendencias de Gastos - Mes Anterior",
					body: "<p>Segue a analise de tendencias de gastos do mes anterior.</p><p>Este relatorio inclui comparativo com o mesmo periodo do ano anterior.</p>",
					includeAttachment: false,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.custom",
			{
				time: "09:00",
				timezone: "America/Sao_Paulo",
				cronPattern: "0 9 1 * *",
			} as TriggerConfig,
			[
				{
					type: "generate_custom_report",
					label: "Gerar Relatorio de Tendencias",
					config: {
						reportType: "spending_trends",
						periodType: "previous_month",
						saveReport: true,
					},
				},
				{
					type: "format_data",
					label: "Formatar como HTML",
					config: {
						outputFormat: "html_table",
						htmlTableStyle: "striped",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail",
					config: {
						to: "owner",
						subject: "Analise de Tendencias de Gastos",
					},
				},
			],
		),
	},

	// Weekly Budget vs Actual Report
	{
		name: "Orcamento vs Real Semanal",
		description:
			"Compara gastos reais com o orcamento planejado e envia alerta de variacoes",
		category: "reporting",
		icon: "Scale",
		tags: ["orcamento", "real", "semanal", "variancia"],
		triggerType: "schedule.weekly",
		triggerConfig: {
			time: "17:00",
			timezone: "America/Sao_Paulo",
			dayOfWeek: 5, // Friday
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "generate_custom_report",
				payload: {
					reportType: "budget_vs_actual",
					periodType: "current_month",
					saveReport: false,
				},
			},
			{
				type: "format_data",
				payload: {
					outputFormat: "html_table",
					htmlTableStyle: "bordered",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Comparativo Orcamento vs Real - Atualizacao Semanal",
					body: "<p>Acompanhe como seus gastos estao em relacao ao orcamento planejado para este mes.</p>",
					includeAttachment: false,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.weekly",
			{
				time: "17:00",
				timezone: "America/Sao_Paulo",
				dayOfWeek: 5,
			} as TriggerConfig,
			[
				{
					type: "generate_custom_report",
					label: "Gerar Comparativo Orcamento vs Real",
					config: {
						reportType: "budget_vs_actual",
						periodType: "current_month",
					},
				},
				{
					type: "format_data",
					label: "Formatar como Tabela HTML",
					config: {
						outputFormat: "html_table",
						htmlTableStyle: "bordered",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail",
					config: {
						to: "owner",
						subject: "Comparativo Orcamento vs Real",
					},
				},
			],
		),
	},

	// Weekly Cash Flow Forecast
	{
		name: "Previsao de Fluxo de Caixa Semanal",
		description:
			"Projeta o fluxo de caixa para os proximos 30 dias com base em contas e padroes recorrentes",
		category: "reporting",
		icon: "Coins",
		tags: ["fluxo-caixa", "previsao", "semanal", "projecao"],
		triggerType: "schedule.weekly",
		triggerConfig: {
			time: "07:00",
			timezone: "America/Sao_Paulo",
			dayOfWeek: 1, // Monday
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "generate_custom_report",
				payload: {
					reportType: "cash_flow_forecast",
					periodType: "current_month",
					forecastDays: 30,
					saveReport: false,
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Previsao de Fluxo de Caixa - Proximos 30 Dias",
					body: "<p>Confira a projecao do seu fluxo de caixa para os proximos 30 dias.</p><p>Esta previsao considera contas a pagar/receber e padroes recorrentes.</p>",
					includeAttachment: false,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.weekly",
			{
				time: "07:00",
				timezone: "America/Sao_Paulo",
				dayOfWeek: 1,
			} as TriggerConfig,
			[
				{
					type: "generate_custom_report",
					label: "Gerar Previsao de Fluxo de Caixa",
					config: {
						reportType: "cash_flow_forecast",
						forecastDays: 30,
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail",
					config: {
						to: "owner",
						subject: "Previsao de Fluxo de Caixa",
					},
				},
			],
		),
	},

	// Monthly Counterparty Analysis
	{
		name: "Analise Mensal de Clientes e Fornecedores",
		description:
			"Analisa transacoes por cliente e fornecedor do mes anterior em formato CSV",
		category: "reporting",
		icon: "Users",
		tags: ["clientes", "fornecedores", "mensal", "analise"],
		triggerType: "schedule.custom",
		triggerConfig: {
			time: "10:00",
			timezone: "America/Sao_Paulo",
			cronPattern: "0 10 1 * *", // 1st of every month at 10:00
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "generate_custom_report",
				payload: {
					reportType: "counterparty_analysis",
					periodType: "previous_month",
					saveReport: true,
					reportName: "Analise de Contrapartes - {{period}}",
				},
			},
			{
				type: "format_data",
				payload: {
					outputFormat: "csv",
					fileName: "contrapartes_{{date}}",
					csvIncludeHeaders: true,
					csvDelimiter: ";",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Analise de Clientes e Fornecedores - Mes Anterior",
					body: "<p>Segue em anexo a analise de transacoes por cliente e fornecedor do mes anterior.</p>",
					includeAttachment: true,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.custom",
			{
				time: "10:00",
				timezone: "America/Sao_Paulo",
				cronPattern: "0 10 1 * *",
			} as TriggerConfig,
			[
				{
					type: "generate_custom_report",
					label: "Gerar Analise de Contrapartes",
					config: {
						reportType: "counterparty_analysis",
						periodType: "previous_month",
						saveReport: true,
					},
				},
				{
					type: "format_data",
					label: "Formatar como CSV",
					config: {
						outputFormat: "csv",
						csvDelimiter: ";",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail com Anexo",
					config: {
						to: "owner",
						subject: "Analise de Clientes e Fornecedores",
						includeAttachment: true,
					},
				},
			],
		),
	},

	// ============================================
	// BUDGET SUITE
	// ============================================

	// Budget Threshold Alert
	{
		name: "Alerta de Limite de Orcamento",
		description:
			"Envia notificacao quando um orcamento atinge 80% ou 100% do limite",
		category: "notifications",
		icon: "AlertTriangle",
		tags: ["orcamento", "alerta", "limite", "notificacao"],
		triggerType: "budget.threshold_reached",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [
				{
					id: "threshold-check",
					type: "number",
					field: "threshold",
					operator: "gte",
					value: 80,
				},
			],
		},
		consequences: [
			{
				type: "send_push_notification",
				payload: {
					title: "Alerta de Orcamento",
					body: "Um orcamento atingiu o limite configurado",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Alerta: Orcamento Proximo do Limite",
					body: "<p>Um dos seus orcamentos atingiu um nivel critico.</p><p>Acesse o sistema para mais detalhes.</p>",
				},
			},
		],
		flowData: generateFlowData(
			"budget.threshold_reached" as TriggerType,
			{} as TriggerConfig,
			[
				{
					type: "send_push_notification",
					label: "Enviar Notificacao Push",
					config: {
						title: "Alerta de Orcamento",
						body: "Um orcamento atingiu o limite configurado",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail",
					config: {
						to: "owner",
						subject: "Alerta: Orcamento Proximo do Limite",
					},
				},
			],
		),
	},

	// Weekly Budget Status Report
	{
		name: "Relatorio Semanal de Orcamentos",
		description:
			"Envia um resumo semanal do status de todos os orcamentos ativos",
		category: "reporting",
		icon: "PieChart",
		tags: ["orcamento", "semanal", "relatorio", "status"],
		triggerType: "schedule.weekly",
		triggerConfig: {
			time: "17:00",
			timezone: "America/Sao_Paulo",
			dayOfWeek: 5, // Friday
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "fetch_budget_report",
				payload: {
					includeOverBudget: true,
					includeNearLimit: true,
					includeInactive: false,
				},
			},
			{
				type: "format_data",
				payload: {
					outputFormat: "html_table",
					htmlTableStyle: "striped",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Relatorio Semanal de Orcamentos",
					body: "<p>Confira o status dos seus orcamentos nesta semana.</p>",
					includeAttachment: false,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.weekly",
			{
				time: "17:00",
				timezone: "America/Sao_Paulo",
				dayOfWeek: 5,
			} as TriggerConfig,
			[
				{
					type: "fetch_budget_report",
					label: "Buscar Relatorio de Orcamentos",
					config: {
						includeOverBudget: true,
						includeNearLimit: true,
					},
				},
				{
					type: "format_data",
					label: "Formatar como Tabela HTML",
					config: {
						outputFormat: "html_table",
						htmlTableStyle: "striped",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail",
					config: {
						to: "owner",
						subject: "Relatorio Semanal de Orcamentos",
					},
				},
			],
		),
	},

	// Budget Overspent Alert
	{
		name: "Alerta Urgente: Orcamento Excedido",
		description:
			"Envia alerta imediato quando um orcamento e excedido (acima de 100%)",
		category: "notifications",
		icon: "AlertOctagon",
		tags: ["orcamento", "excedido", "urgente", "alerta"],
		triggerType: "budget.overspent",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "send_push_notification",
				payload: {
					title: "URGENTE: Orcamento Excedido!",
					body: "Um dos seus orcamentos foi excedido. Verifique imediatamente.",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "URGENTE: Orcamento Excedido",
					body: "<p><strong>Atencao!</strong> Um dos seus orcamentos foi excedido.</p><p>Acesse o sistema imediatamente para revisar seus gastos.</p>",
				},
			},
		],
		flowData: generateFlowData(
			"budget.overspent" as TriggerType,
			{} as TriggerConfig,
			[
				{
					type: "send_push_notification",
					label: "Enviar Notificacao Urgente",
					config: {
						title: "URGENTE: Orcamento Excedido!",
						body: "Um dos seus orcamentos foi excedido",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail Urgente",
					config: {
						to: "owner",
						subject: "URGENTE: Orcamento Excedido",
					},
				},
			],
		),
	},

	// Monthly Budget Summary
	{
		name: "Resumo Mensal de Orcamentos",
		description:
			"Gera e envia um resumo completo dos orcamentos do mes anterior",
		category: "reporting",
		icon: "FileText",
		tags: ["orcamento", "mensal", "resumo", "relatorio"],
		triggerType: "schedule.custom",
		triggerConfig: {
			time: "08:00",
			timezone: "America/Sao_Paulo",
			cronPattern: "0 8 1 * *", // 1st of every month at 08:00
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "fetch_budget_report",
				payload: {
					includeOverBudget: true,
					includeNearLimit: true,
					includeInactive: false,
				},
			},
			{
				type: "format_data",
				payload: {
					outputFormat: "csv",
					fileName: "orcamentos_{{date}}",
					csvIncludeHeaders: true,
					csvDelimiter: ";",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Resumo Mensal de Orcamentos",
					body: "<p>Segue em anexo o resumo completo dos seus orcamentos.</p><p>Este relatorio e gerado automaticamente no primeiro dia de cada mes.</p>",
					includeAttachment: true,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.custom",
			{
				time: "08:00",
				timezone: "America/Sao_Paulo",
				cronPattern: "0 8 1 * *",
			} as TriggerConfig,
			[
				{
					type: "fetch_budget_report",
					label: "Buscar Relatorio de Orcamentos",
					config: {
						includeOverBudget: true,
						includeNearLimit: true,
					},
				},
				{
					type: "format_data",
					label: "Formatar como CSV",
					config: {
						outputFormat: "csv",
						csvDelimiter: ";",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail com Anexo",
					config: {
						to: "owner",
						subject: "Resumo Mensal de Orcamentos",
						includeAttachment: true,
					},
				},
			],
		),
	},

	// ============================================
	// Anomaly Detection Templates
	// ============================================

	// Spending Spike Alert
	{
		name: "Alerta de Pico de Gastos",
		description:
			"Envia notificacao quando um pico de gastos incomum e detectado no periodo",
		category: "notifications",
		icon: "TrendingUp",
		tags: ["anomalia", "gastos", "pico", "alerta"],
		triggerType: "anomaly.spending_spike",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "send_push_notification",
				payload: {
					title: "Pico de Gastos Detectado",
					body: "Seus gastos estao significativamente acima do normal. Verifique suas transacoes.",
				},
			},
		],
		flowData: generateFlowData(
			"anomaly.spending_spike" as TriggerType,
			{} as TriggerConfig,
			[
				{
					type: "send_push_notification",
					label: "Enviar Notificacao",
					config: {
						title: "Pico de Gastos Detectado",
						body: "Gastos acima do normal",
					},
				},
			],
		),
	},

	// Large Transaction Alert
	{
		name: "Alerta de Transacao de Alto Valor",
		description:
			"Envia notificacao quando uma transacao de valor muito alto e detectada",
		category: "notifications",
		icon: "Zap",
		tags: ["anomalia", "transacao", "alto valor", "alerta"],
		triggerType: "anomaly.large_transaction",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "send_push_notification",
				payload: {
					title: "Transacao de Alto Valor",
					body: "Uma transacao de valor incomum foi detectada.",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Alerta: Transacao de Alto Valor Detectada",
					body: "<p>Uma transacao de valor significativamente acima do normal foi detectada em sua conta.</p><p>Verifique se essa transacao e legitima.</p>",
				},
			},
		],
		flowData: generateFlowData(
			"anomaly.large_transaction" as TriggerType,
			{} as TriggerConfig,
			[
				{
					type: "send_push_notification",
					label: "Enviar Notificacao",
					config: {
						title: "Transacao de Alto Valor",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail de Alerta",
					config: {
						to: "owner",
						subject: "Alerta: Transacao de Alto Valor",
					},
				},
			],
		),
	},

	// Unusual Category Spending Alert
	{
		name: "Alerta de Gasto Incomum em Categoria",
		description:
			"Envia notificacao quando gastos em uma categoria estao fora do padrao habitual",
		category: "notifications",
		icon: "Tag",
		tags: ["anomalia", "categoria", "gastos", "alerta"],
		triggerType: "anomaly.unusual_category",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "send_push_notification",
				payload: {
					title: "Gasto Incomum em Categoria",
					body: "Uma categoria apresenta gastos significativamente acima do normal.",
				},
			},
		],
		flowData: generateFlowData(
			"anomaly.unusual_category" as TriggerType,
			{} as TriggerConfig,
			[
				{
					type: "send_push_notification",
					label: "Enviar Notificacao",
					config: {
						title: "Gasto Incomum em Categoria",
					},
				},
			],
		),
	},

	// ============================================
	// Goal Tracking Templates
	// ============================================

	// Goal Milestone Reached
	{
		name: "Notificacao de Marco de Meta",
		description:
			"Envia notificacao quando uma meta atinge um marco importante (25%, 50%, 75%, 100%)",
		category: "notifications",
		icon: "Target",
		tags: ["meta", "marco", "progresso", "celebracao"],
		triggerType: "goal.milestone_reached",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "send_push_notification",
				payload: {
					title: "Marco de Meta Atingido!",
					body: "Parabens! Voce atingiu um marco importante em sua meta financeira.",
				},
			},
		],
		flowData: generateFlowData(
			"goal.milestone_reached" as TriggerType,
			{} as TriggerConfig,
			[
				{
					type: "send_push_notification",
					label: "Enviar Notificacao de Celebracao",
					config: {
						title: "Marco de Meta Atingido!",
					},
				},
			],
		),
	},

	// Goal At Risk Alert
	{
		name: "Alerta de Meta em Risco",
		description:
			"Envia alerta quando uma meta esta em risco de nao ser atingida no prazo",
		category: "notifications",
		icon: "AlertTriangle",
		tags: ["meta", "risco", "prazo", "alerta"],
		triggerType: "goal.at_risk",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "send_push_notification",
				payload: {
					title: "Meta em Risco",
					body: "Sua meta pode nao ser atingida no prazo. Revise seu progresso.",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Alerta: Meta Financeira em Risco",
					body: "<p>Uma de suas metas financeiras esta em risco de nao ser atingida no prazo estabelecido.</p><p>Acesse o sistema para revisar seu progresso e ajustar seu plano se necessario.</p>",
				},
			},
		],
		flowData: generateFlowData(
			"goal.at_risk" as TriggerType,
			{} as TriggerConfig,
			[
				{
					type: "send_push_notification",
					label: "Enviar Notificacao de Alerta",
					config: {
						title: "Meta em Risco",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail de Alerta",
					config: {
						to: "owner",
						subject: "Alerta: Meta Financeira em Risco",
					},
				},
			],
		),
	},

	// Goal Completed
	{
		name: "Celebracao de Meta Concluida",
		description:
			"Envia notificacao de celebracao quando uma meta e concluida com sucesso",
		category: "notifications",
		icon: "Trophy",
		tags: ["meta", "concluida", "sucesso", "celebracao"],
		triggerType: "goal.completed",
		triggerConfig: {} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "send_push_notification",
				payload: {
					title: "Meta Concluida!",
					body: "Parabens! Voce atingiu sua meta financeira. Continue assim!",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Parabens! Voce atingiu sua meta!",
					body: "<p><strong>Parabens!</strong> Voce concluiu uma de suas metas financeiras com sucesso!</p><p>Continue acompanhando suas financas e definindo novas metas para manter o momentum.</p>",
				},
			},
		],
		flowData: generateFlowData(
			"goal.completed" as TriggerType,
			{} as TriggerConfig,
			[
				{
					type: "send_push_notification",
					label: "Enviar Notificacao de Celebracao",
					config: {
						title: "Meta Concluida!",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail de Parabens",
					config: {
						to: "owner",
						subject: "Parabens! Voce atingiu sua meta!",
					},
				},
			],
		),
	},
];

// ============================================
// Seed Functions
// ============================================

async function seedAutomationTemplates(
	db: ReturnType<typeof drizzle>,
	dryRun: boolean,
) {
	console.log(colors.blue("\n📦 Seeding automation templates..."));

	let seeded = 0;
	let skipped = 0;

	for (const template of SYSTEM_TEMPLATES) {
		try {
			if (dryRun) {
				console.log(colors.cyan(`   Would upsert: ${template.name}`));
				seeded++;
			} else {
				const result = await upsertSystemTemplate(db, template);
				if (result) {
					console.log(colors.green(`   ✅ Upserted: ${result.name}`));
					seeded++;
				} else {
					console.log(colors.yellow(`   ⏭️  Skipped: ${template.name}`));
					skipped++;
				}
			}
		} catch (error) {
			console.error(
				colors.red(`   ❌ Failed to upsert "${template.name}":`),
				error,
			);
			throw error;
		}
	}

	console.log(
		colors.green(
			`\n   ${dryRun ? "Would seed" : "Seeded"}: ${seeded}, Skipped: ${skipped}`,
		),
	);
}

async function runSeed(env: string, dryRun: boolean) {
	console.log(colors.blue("🌱 Starting automation templates seed..."));
	console.log(colors.cyan(`   Environment: ${env}`));
	console.log(colors.cyan(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`));
	console.log(colors.cyan("─".repeat(50)));

	const envFile = getEnvFilePath(env);
	console.log(colors.cyan(`   Loading env from: ${envFile}`));
	config({ path: envFile });

	const DATABASE_URL = process.env.DATABASE_URL;

	if (!DATABASE_URL) {
		console.error(colors.red("❌ DATABASE_URL is required"));
		process.exit(1);
	}

	const pool = new Pool({ connectionString: DATABASE_URL });
	const db = drizzle(pool, { schema });

	try {
		await seedAutomationTemplates(db, dryRun);

		console.log(colors.cyan("\n" + "─".repeat(50)));
		if (dryRun) {
			console.log(colors.yellow("⚠️  DRY RUN completed - no data was modified"));
			console.log(colors.yellow("   Run without --dry-run to apply changes"));
		} else {
			console.log(colors.green("✅ Seed completed successfully!"));
		}
	} catch (error) {
		console.error(colors.red("\n❌ Seed failed:"), error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

program
	.name("seed-automation-templates")
	.description("Seed system automation templates into the database")
	.version("1.0.0");

program
	.command("run")
	.description("Run the seed")
	.option("-e, --env <environment>", "Environment (local, production)", "local")
	.option("--dry-run", "Preview changes without modifying data", false)
	.action(async (options) => {
		await runSeed(options.env, options.dryRun).catch((err) => {
			console.error(err);
			process.exit(1);
		});
	});

program
	.command("check")
	.description("Check if required configuration is present")
	.option("-e, --env <environment>", "Environment to use", "local")
	.action((options) => {
		const envFile = getEnvFilePath(options.env);
		config({ path: envFile });

		const dbUrl = process.env.DATABASE_URL;

		console.log(colors.blue("🔍 Checking configuration...\n"));

		if (!dbUrl) {
			console.log(colors.red("❌ DATABASE_URL is not set"));
		} else {
			console.log(colors.green("✅ DATABASE_URL is set"));
		}

		console.log(
			colors.cyan(`\n📋 Templates to seed: ${SYSTEM_TEMPLATES.length}`),
		);
		for (const template of SYSTEM_TEMPLATES) {
			console.log(colors.cyan(`   - ${template.name} (${template.category})`));
		}
	});

program.parse();
