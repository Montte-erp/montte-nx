import type {
	ActionConfig,
	ActionType,
	Consequence,
} from "@packages/database/schema";

export type { ActionConfig, ActionType, Consequence };

export type ActionCategory =
   | "categorization"
   | "tagging"
   | "modification"
   | "creation"
   | "notification"
   | "control"
   | "transformation"
   | "data";

export type ActionAppliesTo = "transaction" | "schedule";

export type ActionDefinition = {
   type: ActionType;
   label: string;
   description: string;
   category: ActionCategory;
   configSchema: ActionConfigField[];
   appliesTo: ActionAppliesTo[];
};

export type ActionConfigField = {
   key: keyof ActionConfig;
   label: string;
   type:
      | "string"
      | "number"
      | "boolean"
      | "select"
      | "multiselect"
      | "template"
      | "category-split";
   required?: boolean;
   defaultValue?: unknown;
   options?: { value: string; label: string }[];
   placeholder?: string;
   helpText?: string;
   dependsOn?: {
      field: keyof ActionConfig;
      value: unknown;
   };
};

export const ACTION_DEFINITIONS: ActionDefinition[] = [
   {
      appliesTo: ["transaction"],
      category: "categorization",
      configSchema: [
         {
            defaultValue: "equal",
            helpText: "Como dividir o valor entre as categorias",
            key: "categorySplitMode",
            label: "Modo de Divisao",
            options: [
               { label: "Categoria Unica / Divisao Igual", value: "equal" },
               { label: "Por Percentual", value: "percentage" },
               { label: "Por Valor Fixo", value: "fixed" },
               { label: "Extrair da Descricao", value: "dynamic" },
            ],
            required: true,
            type: "select",
         },
         {
            helpText: "Selecione as categorias para atribuir",
            key: "categoryIds",
            label: "Categorias",
            type: "category-split",
         },
         {
            helpText:
               "Regex para extrair categoria e percentual da descricao. Ex: alimentacao 80% limpeza 20%",
            key: "dynamicSplitPattern",
            label: "Padrao de Extracao (Regex)",
            placeholder: "(\\w+)\\s+(\\d+)%",
            type: "string",
            dependsOn: { field: "categorySplitMode", value: "dynamic" },
         },
      ],
      description:
         "Atribuir uma ou mais categorias a transacao, com opcao de divisao",
      label: "Definir Categoria",
      type: "set_category",
   },
   {
      appliesTo: ["transaction"],
      category: "tagging",
      configSchema: [
         {
            helpText: "Select tags to add",
            key: "tagIds",
            label: "Tags",
            required: true,
            type: "multiselect",
         },
      ],
      description: "Add one or more tags to the transaction",
      label: "Add Tags",
      type: "add_tag",
   },
   {
      appliesTo: ["transaction"],
      category: "tagging",
      configSchema: [
         {
            helpText: "Select tags to remove",
            key: "tagIds",
            label: "Tags",
            required: true,
            type: "multiselect",
         },
      ],
      description: "Remove one or more tags from the transaction",
      label: "Remove Tags",
      type: "remove_tag",
   },
   {
      appliesTo: ["transaction"],
      category: "categorization",
      configSchema: [
         {
            helpText: "Select the cost center to assign",
            key: "costCenterId",
            label: "Cost Center",
            required: true,
            type: "select",
         },
      ],
      description: "Assign a cost center to the transaction",
      label: "Set Cost Center",
      type: "set_cost_center",
   },
   {
      appliesTo: ["transaction"],
      category: "modification",
      configSchema: [
         {
            defaultValue: "replace",
            key: "mode",
            label: "Mode",
            options: [
               { label: "Replace", value: "replace" },
               { label: "Append", value: "append" },
               { label: "Prepend", value: "prepend" },
            ],
            required: true,
            type: "select",
         },
         {
            helpText: "Use {{field}} to insert dynamic values",
            key: "value",
            label: "Value",
            placeholder: "New description or {{variable}}",
            required: true,
            type: "template",
         },
         {
            defaultValue: true,
            key: "template",
            label: "Use template variables",
            type: "boolean",
         },
      ],
      description: "Modify the transaction description",
      label: "Update Description",
      type: "update_description",
   },
   {
      appliesTo: ["transaction"],
      category: "creation",
      configSchema: [
         {
            key: "type",
            label: "Transaction Type",
            options: [
               { label: "Income", value: "income" },
               { label: "Expense", value: "expense" },
            ],
            required: true,
            type: "select",
         },
         {
            key: "description",
            label: "Description",
            placeholder: "Transaction description",
            required: true,
            type: "template",
         },
         {
            helpText: "Path to the amount value in the event data",
            key: "amountField",
            label: "Amount Source Field",
            placeholder: "e.g., payload.amount",
            type: "string",
         },
         {
            helpText: "Use this if amount is not from event data",
            key: "amountFixed",
            label: "Fixed Amount",
            placeholder: "100.00",
            type: "number",
         },
         {
            key: "bankAccountId",
            label: "Bank Account",
            required: true,
            type: "select",
         },
         {
            key: "categoryId",
            label: "Category",
            type: "select",
         },
         {
            helpText: "Path to the date value, or leave empty for current date",
            key: "dateField",
            label: "Date Source Field",
            placeholder: "e.g., payload.created_at",
            type: "string",
         },
      ],
      description: "Create a new transaction based on this event",
      label: "Create Transaction",
      type: "create_transaction",
   },
   {
      appliesTo: ["transaction"],
      category: "notification",
      configSchema: [
         {
            key: "title",
            label: "Title",
            placeholder: "Notification title",
            required: true,
            type: "template",
         },
         {
            key: "body",
            label: "Body",
            placeholder: "Notification body",
            required: true,
            type: "template",
         },
         {
            key: "url",
            label: "Click URL",
            placeholder: "/transactions/{{id}}",
            type: "string",
         },
      ],
      description: "Send a push notification to device",
      label: "Send Push Notification",
      type: "send_push_notification",
   },
   {
      appliesTo: ["transaction"],
      category: "notification",
      configSchema: [
         {
            defaultValue: "owner",
            key: "to",
            label: "Recipient",
            options: [
               { label: "Organization Owner", value: "owner" },
               { label: "Custom Email", value: "custom" },
            ],
            required: true,
            type: "select",
         },
         {
            dependsOn: { field: "to", value: "custom" },
            key: "customEmail",
            label: "Custom Email",
            placeholder: "email@example.com",
            type: "string",
         },
         {
            key: "subject",
            label: "Subject",
            placeholder: "Email subject",
            required: true,
            type: "template",
         },
         {
            key: "body",
            label: "Body",
            placeholder: "Email body (supports HTML)",
            required: true,
            type: "template",
         },
         {
            defaultValue: "custom",
            key: "useTemplate",
            label: "Modo do Email",
            options: [
               { label: "Personalizado", value: "custom" },
               { label: "Resumo de Contas (usa dados de ação anterior)", value: "bills_digest" },
            ],
            type: "select",
         },
         {
            defaultValue: false,
            key: "includeAttachment",
            label: "Incluir Anexo",
            helpText: "Anexar arquivo gerado pela ação 'Formatar Dados'",
            type: "boolean",
         },
      ],
      description: "Enviar email com template ou personalizado, com suporte a anexos",
      label: "Enviar E-mail",
      type: "send_email",
   },
   {
      appliesTo: ["schedule"],
      category: "notification",
      configSchema: [
         {
            defaultValue: "owner",
            key: "recipients",
            label: "Destinatarios",
            options: [
               { label: "Dono da Organizacao", value: "owner" },
               { label: "Todos os Membros", value: "all_members" },
               { label: "Membros Especificos", value: "specific" },
            ],
            required: true,
            type: "select",
         },
         {
            dependsOn: { field: "recipients", value: "specific" },
            helpText: "Selecione os membros que receberao o email",
            key: "memberIds",
            label: "Membros",
            type: "multiselect",
         },
         {
            defaultValue: "detailed",
            key: "detailLevel",
            label: "Nivel de Detalhe",
            options: [
               { label: "Resumo (totais apenas)", value: "summary" },
               { label: "Detalhado (lista de contas)", value: "detailed" },
               { label: "Completo (com descricoes)", value: "full" },
            ],
            required: true,
            type: "select",
         },
         {
            defaultValue: true,
            key: "includePending",
            label: "Incluir Pendentes",
            helpText: "Incluir contas a vencer no periodo",
            type: "boolean",
         },
         {
            defaultValue: true,
            key: "includeOverdue",
            label: "Incluir Vencidas",
            helpText: "Incluir contas ja vencidas",
            type: "boolean",
         },
         {
            defaultValue: 7,
            key: "daysAhead",
            label: "Dias a Frente",
            helpText: "Quantos dias a frente considerar para contas pendentes",
            placeholder: "7",
            type: "number",
         },
         {
            defaultValue: ["expense"],
            key: "billTypes",
            label: "Tipos de Conta",
            options: [
               { label: "Despesas", value: "expense" },
               { label: "Receitas", value: "income" },
            ],
            type: "multiselect",
         },
      ],
      description: "Envia email com resumo de contas a pagar/receber",
      label: "Enviar Resumo de Contas",
      type: "send_bills_digest",
   },
   {
      appliesTo: ["schedule"],
      category: "notification",
      configSchema: [
         {
            defaultValue: true,
            key: "includePending",
            label: "Incluir Pendentes",
            helpText: "Incluir contas a vencer no periodo",
            type: "boolean",
         },
         {
            defaultValue: true,
            key: "includeOverdue",
            label: "Incluir Vencidas",
            helpText: "Incluir contas ja vencidas",
            type: "boolean",
         },
         {
            defaultValue: 7,
            key: "daysAhead",
            label: "Dias a Frente",
            helpText: "Quantos dias a frente considerar para contas pendentes",
            placeholder: "7",
            type: "number",
         },
         {
            defaultValue: ["expense"],
            key: "billTypes",
            label: "Tipos de Conta",
            options: [
               { label: "Despesas", value: "expense" },
               { label: "Receitas", value: "income" },
            ],
            type: "multiselect",
         },
      ],
      description: "Busca contas a pagar/receber para usar em proximas acoes",
      label: "Buscar Relatorio de Contas",
      type: "fetch_bills_report",
   },
   {
      appliesTo: ["transaction", "schedule"],
      category: "transformation",
      configSchema: [
         {
            key: "outputFormat",
            label: "Formato de Saída",
            options: [
               { label: "CSV", value: "csv" },
               { label: "PDF", value: "pdf" },
               { label: "Tabela HTML", value: "html_table" },
               { label: "JSON", value: "json" },
            ],
            required: true,
            type: "select",
         },
         {
            helpText: "Nome do arquivo gerado. Use {{period}} para período",
            key: "fileName",
            label: "Nome do Arquivo",
            placeholder: "relatorio_{{period}}",
            type: "template",
         },
         {
            defaultValue: true,
            dependsOn: { field: "outputFormat", value: "csv" },
            key: "csvIncludeHeaders",
            label: "Incluir Cabeçalhos",
            helpText: "Incluir linha de cabeçalho no CSV",
            type: "boolean",
         },
         {
            defaultValue: ",",
            dependsOn: { field: "outputFormat", value: "csv" },
            key: "csvDelimiter",
            label: "Delimitador",
            options: [
               { label: "Vírgula (,)", value: "," },
               { label: "Ponto e vírgula (;)", value: ";" },
               { label: "Tab", value: "\t" },
            ],
            type: "select",
         },
         {
            defaultValue: "bills_report",
            dependsOn: { field: "outputFormat", value: "pdf" },
            key: "pdfTemplate",
            label: "Template PDF",
            options: [
               { label: "Relatório de Contas", value: "bills_report" },
               { label: "Personalizado", value: "custom" },
            ],
            type: "select",
         },
         {
            defaultValue: "A4",
            dependsOn: { field: "outputFormat", value: "pdf" },
            key: "pdfPageSize",
            label: "Tamanho da Página",
            options: [
               { label: "A4", value: "A4" },
               { label: "Carta (Letter)", value: "Letter" },
            ],
            type: "select",
         },
         {
            defaultValue: "striped",
            dependsOn: { field: "outputFormat", value: "html_table" },
            key: "htmlTableStyle",
            label: "Estilo da Tabela",
            options: [
               { label: "Padrão", value: "default" },
               { label: "Listrado", value: "striped" },
               { label: "Com Bordas", value: "bordered" },
            ],
            type: "select",
         },
      ],
      description:
         "Transforma dados em CSV, PDF, HTML ou JSON para usar em próximas ações (ex: anexo de email)",
      label: "Formatar Dados",
      type: "format_data",
   },
   {
      appliesTo: ["transaction"],
      category: "control",
      configSchema: [
         {
            key: "reason",
            label: "Reason",
            placeholder: "Optional reason for stopping",
            type: "string",
         },
      ],
      description: "Stop processing further rules for this event",
      label: "Stop Execution",
      type: "stop_execution",
   },
   {
      appliesTo: ["transaction"],
      category: "modification",
      configSchema: [
         {
            helpText: "Select the destination account for the transfer",
            key: "toBankAccountId",
            label: "Destination Account",
            required: true,
            type: "select",
         },
      ],
      description: "Mark the transaction as a transfer to another account",
      label: "Mark as Transfer",
      type: "mark_as_transfer",
   },
];

export type ActionExecutionContext = {
   organizationId: string;
   eventData: Record<string, unknown>;
   ruleId: string;
   dryRun?: boolean;
};

export type ActionExecutionResult = {
	consequenceIndex?: number;
	type: string;
	success: boolean;
	result?: unknown;
	error?: string;
	skipped?: boolean;
	skipReason?: string;
	outputData?: Record<string, unknown>;
};

export type ConsequenceExecutionResult = {
	consequenceIndex: number;
	type: string;
	success: boolean;
	result?: unknown;
	error?: string;
	skipped?: boolean;
	skipReason?: string;
	outputData?: Record<string, unknown>;
};

export function createConsequence(
	type: ActionType,
	payload: ActionConfig,
): Consequence {
	return {
		payload,
		type,
	};
}

export function getActionDefinition(
   type: ActionType,
): ActionDefinition | undefined {
   return ACTION_DEFINITIONS.find((def) => def.type === type);
}

export function getActionsForTrigger(
   triggerType: ActionAppliesTo,
): ActionDefinition[] {
   return ACTION_DEFINITIONS.filter((def) =>
      def.appliesTo.includes(triggerType),
   );
}
