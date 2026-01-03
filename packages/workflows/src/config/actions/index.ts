import type { ActionType } from "@packages/database/schema";
import type {
	ActionAppliesTo,
	ActionCategory,
	ActionDefinition,
	ActionTab,
} from "../../schemas/action-definition.schema";
import type { ActionField } from "../../schemas/action-field.schema";
import { createAction } from "../../lib/define-action";

// ============================================
// Action Definitions
// ============================================

const setCategoryAction = createAction("set_category", {
	label: "Definir Categoria",
	description:
		"Atribuir uma ou mais categorias a transacao, com opcao de divisao",
	category: "categorization",
	appliesTo: ["transaction"],
	fields: [
		{
			key: "categorySplitMode",
			type: "select",
			label: "Modo de Divisao",
			required: true,
			defaultValue: "equal",
			options: [
				{ value: "equal", label: "Categoria Unica / Divisao Igual" },
				{ value: "percentage", label: "Por Percentual" },
				{ value: "fixed", label: "Por Valor Fixo" },
				{ value: "dynamic", label: "Extrair da Descricao" },
			],
			helpText: "Como dividir o valor entre as categorias",
		},
		{
			key: "categoryIds",
			type: "category-split",
			label: "Categorias",
			helpText: "Selecione as categorias para atribuir",
		},
		{
			key: "dynamicSplitPattern",
			type: "string",
			label: "Padrao de Extracao (Regex)",
			placeholder: "(\\w+)\\s+(\\d+)%",
			helpText:
				"Regex para extrair categoria e percentual da descricao. Ex: alimentacao 80% limpeza 20%",
			dependsOn: { field: "categorySplitMode", value: "dynamic" },
		},
	],
});

const addTagAction = createAction("add_tag", {
	label: "Add Tags",
	description: "Add one or more tags to the transaction",
	category: "tagging",
	appliesTo: ["transaction"],
	fields: [
		{
			key: "tagIds",
			type: "multiselect",
			label: "Tags",
			required: true,
			helpText: "Select tags to add",
			dataSource: "tags",
		},
	],
});

const removeTagAction = createAction("remove_tag", {
	label: "Remove Tags",
	description: "Remove one or more tags from the transaction",
	category: "tagging",
	appliesTo: ["transaction"],
	fields: [
		{
			key: "tagIds",
			type: "multiselect",
			label: "Tags",
			required: true,
			helpText: "Select tags to remove",
			dataSource: "tags",
		},
	],
});

const setCostCenterAction = createAction("set_cost_center", {
	label: "Set Cost Center",
	description: "Assign a cost center to the transaction",
	category: "categorization",
	appliesTo: ["transaction"],
	fields: [
		{
			key: "costCenterId",
			type: "select",
			label: "Cost Center",
			required: true,
			helpText: "Select the cost center to assign",
			dataSource: "costCenters",
		},
	],
});

const updateDescriptionAction = createAction("update_description", {
	label: "Update Description",
	description: "Modify the transaction description",
	category: "modification",
	appliesTo: ["transaction"],
	fields: [
		{
			key: "mode",
			type: "select",
			label: "Mode",
			required: true,
			defaultValue: "replace",
			options: [
				{ value: "replace", label: "Replace" },
				{ value: "append", label: "Append" },
				{ value: "prepend", label: "Prepend" },
			],
		},
		{
			key: "value",
			type: "template",
			label: "Value",
			required: true,
			placeholder: "New description or {{variable}}",
			helpText: "Use {{field}} to insert dynamic values",
		},
		{
			key: "template",
			type: "boolean",
			label: "Use template variables",
			defaultValue: true,
		},
	],
});

const createTransactionAction = createAction("create_transaction", {
	label: "Criar Transação",
	description: "Cria uma nova transação baseada neste evento",
	category: "creation",
	appliesTo: ["transaction"],
	tabs: [
		{ id: "main", label: "Principal", order: 1 },
		{ id: "details", label: "Detalhes", order: 2 },
	],
	defaultTab: "main",
	fields: [
		{
			key: "type",
			type: "select",
			label: "Tipo",
			required: true,
			tab: "main",
			order: 1,
			helpText: "Tipo da transação a ser criada",
			options: [
				{ value: "income", label: "Receita" },
				{ value: "expense", label: "Despesa" },
			],
		},
		{
			key: "bankAccountId",
			type: "select",
			label: "Conta",
			required: true,
			tab: "main",
			order: 2,
			helpText: "Conta bancária onde registrar a transação",
			dataSource: "bankAccounts",
		},
		{
			key: "amountField",
			type: "string",
			label: "Campo do Valor",
			tab: "main",
			order: 3,
			placeholder: "ex: payload.amount",
			helpText: "Caminho para o valor nos dados do evento",
		},
		{
			key: "amountFixed",
			type: "number",
			label: "Valor Fixo",
			tab: "main",
			order: 4,
			placeholder: "100.00",
			helpText: "Use se o valor não vem dos dados do evento",
		},
		{
			key: "description",
			type: "template",
			label: "Descrição",
			required: true,
			tab: "details",
			order: 1,
			placeholder: "Descrição da transação",
			helpText: "Use {{variavel}} para valores dinâmicos",
		},
		{
			key: "categoryId",
			type: "select",
			label: "Categoria",
			tab: "details",
			order: 2,
			helpText: "Categoria para a nova transação",
			dataSource: "categories",
		},
		{
			key: "dateField",
			type: "string",
			label: "Campo da Data",
			tab: "details",
			order: 3,
			placeholder: "ex: payload.created_at",
			helpText: "Caminho para a data. Deixe vazio para data atual",
		},
	],
});

const sendPushNotificationAction = createAction("send_push_notification", {
	label: "Send Push Notification",
	description: "Send a push notification to device",
	category: "notification",
	appliesTo: ["transaction"],
	fields: [
		{
			key: "title",
			type: "template",
			label: "Title",
			required: true,
			placeholder: "Notification title",
		},
		{
			key: "body",
			type: "template",
			label: "Body",
			required: true,
			placeholder: "Notification body",
		},
		{
			key: "url",
			type: "string",
			label: "Click URL",
			placeholder: "/transactions/{{id}}",
		},
	],
});

const sendEmailAction = createAction("send_email", {
	label: "Enviar E-mail",
	description:
		"Enviar email com template ou personalizado, com suporte a anexos",
	category: "notification",
	appliesTo: ["transaction", "schedule"],
	tabs: [
		{ id: "recipients", label: "Destinatário", order: 1 },
		{ id: "content", label: "Conteúdo", order: 2 },
	],
	defaultTab: "content",
	dataFlow: {
		optionalInputs: ["bills_data", "formatted_file"],
		optionalInputsLabel: "Dados ou Arquivo",
	},
	fields: [
		{
			key: "to",
			type: "select",
			label: "Destinatário",
			required: true,
			defaultValue: "owner",
			tab: "recipients",
			order: 1,
			helpText: "Quem recebe este email",
			options: [
				{ value: "owner", label: "Dono da Organização" },
				{ value: "custom", label: "Email Personalizado" },
			],
		},
		{
			key: "customEmail",
			type: "string",
			label: "Email",
			tab: "recipients",
			order: 2,
			placeholder: "email@exemplo.com",
			helpText: "Endereço de email personalizado",
			dependsOn: { field: "to", value: "custom" },
		},
		{
			key: "useTemplate",
			type: "select",
			label: "Modo do Email",
			tab: "content",
			order: 1,
			defaultValue: "custom",
			helpText:
				"Escolha entre email personalizado, editor visual ou template de Resumo de Contas.",
			options: [
				{ value: "custom", label: "HTML Personalizado" },
				{ value: "visual", label: "Editor Visual" },
				{
					value: "bills_digest",
					label: "Resumo de Contas (usa dados de ação anterior)",
				},
			],
		},
		{
			key: "emailTemplate",
			type: "email-builder",
			label: "Template Visual",
			tab: "content",
			order: 2,
			helpText: "Configure o layout do email usando o editor visual",
			dependsOn: { field: "useTemplate", value: "visual" },
		},
		{
			key: "subject",
			type: "template",
			label: "Assunto",
			tab: "content",
			order: 3,
			placeholder: "Assunto do email",
			helpText: "Assunto do email. Use {{variavel}} para valores dinâmicos",
			dependsOn: { field: "useTemplate", value: "custom" },
		},
		{
			key: "body",
			type: "template",
			label: "Corpo",
			tab: "content",
			order: 4,
			placeholder: "Corpo do email (suporta HTML)",
			helpText: "Corpo do email em HTML. Use {{variavel}} para valores dinâmicos",
			dependsOn: { field: "useTemplate", value: "custom" },
		},
		{
			key: "includeAttachment",
			type: "boolean",
			label: "Incluir Anexo",
			tab: "content",
			order: 5,
			defaultValue: false,
			helpText:
				"Anexar arquivo gerado pela ação 'Formatar Dados'. Requer uma ação 'Formatar Dados' anterior no fluxo.",
		},
	],
});

const fetchBillsReportAction = createAction("fetch_bills_report", {
	label: "Buscar Relatório de Contas",
	description: "Busca contas a pagar/receber para usar em próximas ações",
	category: "data",
	appliesTo: ["schedule"],
	tabs: [
		{ id: "filters", label: "Filtros", order: 1 },
	],
	defaultTab: "filters",
	dataFlow: {
		produces: "bills_data",
		producesLabel: "Dados de Contas",
	},
	fields: [
		{
			key: "includePending",
			type: "boolean",
			label: "Incluir Pendentes",
			tab: "filters",
			order: 1,
			defaultValue: true,
			helpText: "Incluir contas a vencer no período",
		},
		{
			key: "includeOverdue",
			type: "boolean",
			label: "Incluir Vencidas",
			tab: "filters",
			order: 2,
			defaultValue: true,
			helpText: "Incluir contas já vencidas",
		},
		{
			key: "daysAhead",
			type: "number",
			label: "Dias à Frente",
			tab: "filters",
			order: 3,
			defaultValue: 7,
			placeholder: "7",
			helpText: "Quantos dias à frente considerar (deve ser maior que 0)",
		},
		{
			key: "billTypes",
			type: "multiselect",
			label: "Tipos de Conta",
			tab: "filters",
			order: 4,
			defaultValue: ["expense"],
			helpText: "Selecione pelo menos um tipo de conta",
			options: [
				{ value: "expense", label: "Despesas" },
				{ value: "income", label: "Receitas" },
			],
		},
	],
});

const formatDataAction = createAction("format_data", {
	label: "Formatar Dados",
	description:
		"Transforma dados em CSV, PDF, HTML ou JSON para usar em próximas ações (ex: anexo de email)",
	category: "transformation",
	appliesTo: ["transaction", "schedule"],
	tabs: [
		{ id: "format", label: "Formato", order: 1 },
		{ id: "csv", label: "Opções CSV", order: 2 },
		{ id: "pdf", label: "Opções PDF", order: 3 },
		{ id: "html", label: "Opções HTML", order: 4 },
	],
	defaultTab: "format",
	dataFlow: {
		optionalInputs: ["bills_data", "any_data"],
		optionalInputsLabel: "Dados a Formatar",
		produces: "formatted_file",
		producesLabel: "Arquivo Formatado",
	},
	fields: [
		{
			key: "outputFormat",
			type: "select",
			label: "Formato de Saída",
			required: true,
			tab: "format",
			order: 1,
			helpText: "CSV, HTML ou JSON. Nota: PDF ainda não implementado.",
			options: [
				{ value: "csv", label: "CSV" },
				{ value: "pdf", label: "PDF (em breve)" },
				{ value: "html_table", label: "Tabela HTML" },
				{ value: "json", label: "JSON" },
			],
		},
		{
			key: "fileName",
			type: "template",
			label: "Nome do Arquivo",
			tab: "format",
			order: 2,
			placeholder: "relatorio_{{period}}",
			helpText: "Nome do arquivo gerado. Use {{period}}, {{date}} ou {{timestamp}}",
		},
		{
			key: "csvIncludeHeaders",
			type: "boolean",
			label: "Incluir Cabeçalhos",
			tab: "csv",
			order: 1,
			defaultValue: true,
			helpText: "Incluir linha de cabeçalho no CSV",
			dependsOn: { field: "outputFormat", value: "csv" },
		},
		{
			key: "csvDelimiter",
			type: "select",
			label: "Delimitador",
			tab: "csv",
			order: 2,
			defaultValue: ",",
			helpText: "Caractere separador das colunas",
			options: [
				{ value: ",", label: "Vírgula (,)" },
				{ value: ";", label: "Ponto e vírgula (;)" },
				{ value: "\t", label: "Tab" },
			],
			dependsOn: { field: "outputFormat", value: "csv" },
		},
		{
			key: "pdfTemplate",
			type: "select",
			label: "Template PDF",
			tab: "pdf",
			order: 1,
			defaultValue: "bills_report",
			helpText: "Modelo visual do relatório PDF",
			options: [
				{ value: "bills_report", label: "Relatório de Contas" },
				{ value: "custom", label: "Personalizado" },
			],
			dependsOn: { field: "outputFormat", value: "pdf" },
		},
		{
			key: "pdfPageSize",
			type: "select",
			label: "Tamanho da Página",
			tab: "pdf",
			order: 2,
			defaultValue: "A4",
			helpText: "Tamanho do papel para o PDF",
			options: [
				{ value: "A4", label: "A4" },
				{ value: "Letter", label: "Carta (Letter)" },
			],
			dependsOn: { field: "outputFormat", value: "pdf" },
		},
		{
			key: "htmlTableStyle",
			type: "select",
			label: "Estilo da Tabela",
			tab: "html",
			order: 1,
			defaultValue: "striped",
			helpText: "Aparência visual da tabela HTML",
			options: [
				{ value: "default", label: "Padrão" },
				{ value: "striped", label: "Listrado" },
				{ value: "bordered", label: "Com Bordas" },
			],
			dependsOn: { field: "outputFormat", value: "html_table" },
		},
	],
});

const stopExecutionAction = createAction("stop_execution", {
	label: "Stop Execution",
	description: "Stop processing further rules for this event",
	category: "control",
	appliesTo: ["transaction"],
	fields: [
		{
			key: "reason",
			type: "string",
			label: "Reason",
			placeholder: "Optional reason for stopping",
		},
	],
});

const markAsTransferAction = createAction("mark_as_transfer", {
	label: "Mark as Transfer",
	description: "Mark the transaction as a transfer to another account",
	category: "modification",
	appliesTo: ["transaction"],
	fields: [
		{
			key: "toBankAccountId",
			type: "select",
			label: "Destination Account",
			required: true,
			helpText: "Select the destination account for the transfer",
			dataSource: "bankAccounts",
		},
	],
});

const generateCustomReportAction = createAction("generate_custom_report", {
	label: "Gerar Relatório Personalizado",
	description: "Gera relatórios financeiros como DRE, Tendências de Gastos, Fluxo de Caixa e mais",
	category: "data",
	appliesTo: ["schedule"],
	tabs: [
		{ id: "report", label: "Relatório", order: 1 },
		{ id: "period", label: "Período", order: 2 },
		{ id: "filters", label: "Filtros", order: 3 },
	],
	defaultTab: "report",
	dataFlow: {
		produces: "report_data",
		producesLabel: "Dados do Relatório",
	},
	fields: [
		{
			key: "reportType",
			type: "select",
			label: "Tipo de Relatório",
			required: true,
			tab: "report",
			order: 1,
			helpText: "Selecione o tipo de relatório a gerar",
			options: [
				{ value: "dre_gerencial", label: "DRE Gerencial" },
				{ value: "dre_fiscal", label: "DRE Fiscal" },
				{ value: "budget_vs_actual", label: "Orçado vs Realizado" },
				{ value: "spending_trends", label: "Tendências de Gastos" },
				{ value: "cash_flow_forecast", label: "Previsão de Fluxo de Caixa" },
				{ value: "counterparty_analysis", label: "Análise de Contrapartes" },
			],
		},
		{
			key: "saveReport",
			type: "boolean",
			label: "Salvar Relatório",
			tab: "report",
			order: 2,
			defaultValue: false,
			helpText: "Salvar o relatório no histórico para consulta posterior",
		},
		{
			key: "reportName",
			type: "template",
			label: "Nome do Relatório",
			tab: "report",
			order: 3,
			placeholder: "{{reportType}} - {{date}}",
			helpText: "Nome do relatório salvo. Use {{reportType}}, {{date}}, {{period}}",
			dependsOn: { field: "saveReport", value: true },
		},
		{
			key: "periodType",
			type: "select",
			label: "Período",
			required: true,
			tab: "period",
			order: 1,
			defaultValue: "previous_month",
			helpText: "Período de dados para o relatório",
			options: [
				{ value: "previous_month", label: "Mês Anterior" },
				{ value: "previous_week", label: "Semana Anterior" },
				{ value: "current_month", label: "Mês Atual" },
				{ value: "custom", label: "Personalizado" },
			],
		},
		{
			key: "daysBack",
			type: "number",
			label: "Dias Anteriores",
			tab: "period",
			order: 2,
			placeholder: "30",
			helpText: "Número de dias para período personalizado",
			dependsOn: { field: "periodType", value: "custom" },
		},
		{
			key: "forecastDays",
			type: "number",
			label: "Dias de Previsão",
			tab: "period",
			order: 3,
			defaultValue: 30,
			placeholder: "30",
			helpText: "Dias à frente para previsão de fluxo de caixa (7-365)",
		},
	],
});

const fetchBudgetReportAction = createAction("fetch_budget_report", {
	label: "Buscar Relatório de Orçamentos",
	description: "Busca status dos orçamentos para usar em próximas ações",
	category: "data",
	appliesTo: ["schedule", "budget"],
	tabs: [
		{ id: "filters", label: "Filtros", order: 1 },
	],
	defaultTab: "filters",
	dataFlow: {
		produces: "budget_data",
		producesLabel: "Dados de Orçamentos",
	},
	fields: [
		{
			key: "includeOverBudget",
			type: "boolean",
			label: "Incluir Excedidos",
			tab: "filters",
			order: 1,
			defaultValue: true,
			helpText: "Incluir orçamentos que excederam o limite",
		},
		{
			key: "includeNearLimit",
			type: "boolean",
			label: "Incluir Próximos do Limite",
			tab: "filters",
			order: 2,
			defaultValue: true,
			helpText: "Incluir orçamentos acima de 80% do limite",
		},
		{
			key: "includeInactive",
			type: "boolean",
			label: "Incluir Inativos",
			tab: "filters",
			order: 3,
			defaultValue: false,
			helpText: "Incluir orçamentos inativos",
		},
		{
			key: "budgetIds",
			type: "multiselect",
			label: "Orçamentos Específicos",
			tab: "filters",
			order: 4,
			helpText: "Selecione orçamentos específicos ou deixe vazio para todos",
			dataSource: "budgets",
		},
	],
});

const checkBudgetStatusAction = createAction("check_budget_status", {
	label: "Verificar Status de Orçamentos",
	description: "Verifica status dos orçamentos e retorna alertas de threshold",
	category: "data",
	appliesTo: ["transaction", "schedule", "budget"],
	fields: [
		{
			key: "alertThresholds",
			type: "multiselect",
			label: "Thresholds de Alerta",
			defaultValue: ["50", "80", "100"],
			helpText: "Percentuais que disparam alertas (ex: 50%, 80%, 100%)",
			options: [
				{ value: "50", label: "50%" },
				{ value: "80", label: "80%" },
				{ value: "100", label: "100%" },
			],
		},
		{
			key: "checkCurrentStatus",
			type: "boolean",
			label: "Verificar Status Atual",
			defaultValue: true,
			helpText: "Verificar o status atual de todos os orçamentos afetados",
		},
	],
});

// ============================================
// Unified Actions Config
// ============================================

/**
 * Unified configuration for all action types.
 * Use this as the single source of truth for action definitions.
 */
export const actionsConfig = {
	set_category: setCategoryAction,
	add_tag: addTagAction,
	remove_tag: removeTagAction,
	set_cost_center: setCostCenterAction,
	update_description: updateDescriptionAction,
	create_transaction: createTransactionAction,
	send_push_notification: sendPushNotificationAction,
	send_email: sendEmailAction,
	fetch_bills_report: fetchBillsReportAction,
	format_data: formatDataAction,
	stop_execution: stopExecutionAction,
	mark_as_transfer: markAsTransferAction,
	generate_custom_report: generateCustomReportAction,
	fetch_budget_report: fetchBudgetReportAction,
	check_budget_status: checkBudgetStatusAction,
} as const satisfies Record<ActionType, ActionDefinition>;

// ============================================
// Helper Functions
// ============================================

/**
 * Gets an action definition by type
 */
export function getAction(type: ActionType): ActionDefinition {
	return actionsConfig[type];
}

/**
 * Gets the tabs for an action (if any)
 */
export function getActionTabs(type: ActionType): ActionTab[] {
	return actionsConfig[type].tabs ?? [];
}

/**
 * Gets fields for a specific tab
 */
export function getFieldsForTab(type: ActionType, tabId: string): ActionField[] {
	return actionsConfig[type].fields.filter((f) => f.tab === tabId);
}

/**
 * Gets all action definitions as an array
 */
export function getAllActions(): ActionDefinition[] {
	return Object.values(actionsConfig);
}

/**
 * Gets actions that apply to a specific trigger type
 */
export function getActionsForTrigger(
	trigger: ActionAppliesTo,
): ActionDefinition[] {
	return getAllActions().filter((a) => a.appliesTo.includes(trigger));
}

/**
 * Checks if an action has tabs
 */
export function hasActionTabs(type: ActionType): boolean {
	const action = actionsConfig[type];
	return action.tabs !== undefined && action.tabs.length > 0;
}

/**
 * Gets all actions grouped by category
 */
export function getActionsByCategory(): Record<ActionCategory, ActionDefinition[]> {
	return getAllActions().reduce(
		(acc, action) => {
			const cat = action.category;
			acc[cat] = acc[cat] || [];
			acc[cat].push(action);
			return acc;
		},
		{} as Record<ActionCategory, ActionDefinition[]>,
	);
}

/**
 * Gets all unique categories that have at least one action
 */
export function getUniqueCategories(): ActionCategory[] {
	return [...new Set(getAllActions().map((a) => a.category))];
}

/**
 * Gets actions for a specific category
 */
export function getActionsForCategory(category: ActionCategory): ActionDefinition[] {
	return getAllActions().filter((a) => a.category === category);
}

// Re-export types
export type { ActionDefinition, ActionAppliesTo, ActionCategory, ActionTab, ActionField };
