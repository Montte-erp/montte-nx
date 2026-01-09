import type { TriggerConfig, TriggerType } from "@packages/database/schema";
import type { ConditionFieldDefinition } from "../types/conditions";
import { TRANSACTION_FIELDS } from "../types/conditions";

export type TriggerDefinition = {
   type: TriggerType;
   label: string;
   description: string;
   category: "transaction" | "scheduled" | "webhook";
   availableFields: ConditionFieldDefinition[];
   eventDataSchema: EventDataField[];
   supportsSimulation: boolean;
   configSchema?: TriggerConfigField[];
};

export type EventDataField = {
   field: string;
   label: string;
   type: "string" | "number" | "boolean" | "date" | "array" | "object";
   description?: string;
   required?: boolean;
};

export type TriggerConfigField = {
   key: string;
   label: string;
   type: "string" | "number" | "boolean" | "select" | "multiselect";
   required?: boolean;
   defaultValue?: unknown;
   options?: { value: string; label: string }[];
   placeholder?: string;
   helpText?: string;
};

const SCHEDULE_EVENT_DATA_SCHEMA: EventDataField[] = [
	{
		field: "triggerTime",
		label: "Trigger Time",
		required: true,
		type: "date",
		description: "The time when the schedule was triggered",
	},
	{
		field: "organizationId",
		label: "Organization ID",
		required: true,
		type: "string",
	},
	{
		field: "automationRuleId",
		label: "Automation Rule ID",
		required: true,
		type: "string",
	},
];

const SCHEDULE_CONFIG_SCHEMA: TriggerConfigField[] = [
	{
		key: "time",
		label: "Horario",
		type: "string",
		required: true,
		placeholder: "09:00",
		helpText: "Horario no formato HH:mm (24h)",
	},
	{
		key: "timezone",
		label: "Fuso Horario",
		type: "string",
		required: false,
		defaultValue: "America/Sao_Paulo",
		helpText: "Fuso horario IANA (ex: America/Sao_Paulo)",
	},
];

const SCHEDULE_WEEKLY_CONFIG_SCHEMA: TriggerConfigField[] = [
	...SCHEDULE_CONFIG_SCHEMA,
	{
		key: "dayOfWeek",
		label: "Dia da Semana",
		type: "select",
		required: true,
		defaultValue: 1,
		options: [
			{ value: "0", label: "Domingo" },
			{ value: "1", label: "Segunda-feira" },
			{ value: "2", label: "Terca-feira" },
			{ value: "3", label: "Quarta-feira" },
			{ value: "4", label: "Quinta-feira" },
			{ value: "5", label: "Sexta-feira" },
			{ value: "6", label: "Sabado" },
		],
	},
];

const SCHEDULE_CUSTOM_CONFIG_SCHEMA: TriggerConfigField[] = [
	{
		key: "cronPattern",
		label: "Padrao Cron",
		type: "string",
		required: true,
		placeholder: "0 9 * * 1",
		helpText: "Expressao cron (minuto hora dia-mes mes dia-semana)",
	},
	{
		key: "timezone",
		label: "Fuso Horario",
		type: "string",
		required: false,
		defaultValue: "America/Sao_Paulo",
		helpText: "Fuso horario IANA (ex: America/Sao_Paulo)",
	},
];

const TRANSACTION_EVENT_DATA_SCHEMA: EventDataField[] = [
   { field: "id", label: "Transaction ID", required: true, type: "string" },
   {
      field: "organizationId",
      label: "Organization ID",
      required: true,
      type: "string",
   },
   {
      field: "description",
      label: "Description",
      required: true,
      type: "string",
   },
   { field: "amount", label: "Amount", required: true, type: "number" },
   {
      description: "income, expense, or transfer",
      field: "type",
      label: "Type",
      required: true,
      type: "string",
   },
   { field: "date", label: "Date", required: true, type: "date" },
   { field: "bankAccountId", label: "Bank Account ID", type: "string" },
   { field: "categoryIds", label: "Category IDs", type: "array" },
   { field: "costCenterId", label: "Cost Center ID", type: "string" },
   { field: "counterpartyId", label: "Counterparty ID", type: "string" },
   { field: "tagIds", label: "Tag IDs", type: "array" },
   { field: "metadata", label: "Metadata", type: "object" },
];

const ANOMALY_EVENT_DATA_SCHEMA: EventDataField[] = [
	{
		field: "id",
		label: "Anomaly ID",
		required: true,
		type: "string",
	},
	{
		field: "organizationId",
		label: "Organization ID",
		required: true,
		type: "string",
	},
	{
		field: "type",
		label: "Anomaly Type",
		required: true,
		type: "string",
		description: "spending_spike, unusual_category, or large_transaction",
	},
	{
		field: "severity",
		label: "Severity",
		required: true,
		type: "string",
		description: "low, medium, or high",
	},
	{
		field: "title",
		label: "Title",
		required: true,
		type: "string",
	},
	{
		field: "description",
		label: "Description",
		type: "string",
	},
	{
		field: "amount",
		label: "Amount",
		type: "number",
	},
	{
		field: "transactionId",
		label: "Transaction ID",
		type: "string",
	},
	{
		field: "metadata",
		label: "Metadata",
		type: "object",
		description: "Additional anomaly data (zScore, mean, etc.)",
	},
];

const ANOMALY_FIELDS: ConditionFieldDefinition[] = [
	{
		field: "severity",
		label: "Severidade",
		type: "string",
		operators: ["eq", "neq", "in", "not_in"],
		valueOptions: [
			{ value: "low", label: "Baixa" },
			{ value: "medium", label: "Média" },
			{ value: "high", label: "Alta" },
		],
	},
	{
		field: "amount",
		label: "Valor",
		type: "number",
		operators: ["eq", "neq", "gt", "lt", "gte", "lte", "between"],
	},
];

const GOAL_EVENT_DATA_SCHEMA: EventDataField[] = [
	{
		field: "goalId",
		label: "Goal ID",
		required: true,
		type: "string",
	},
	{
		field: "organizationId",
		label: "Organization ID",
		required: true,
		type: "string",
	},
	{
		field: "goalName",
		label: "Goal Name",
		required: true,
		type: "string",
	},
	{
		field: "goalType",
		label: "Goal Type",
		required: true,
		type: "string",
		description: "savings, debt_payoff, spending_limit, or income_target",
	},
	{
		field: "targetAmount",
		label: "Target Amount",
		required: true,
		type: "number",
	},
	{
		field: "currentAmount",
		label: "Current Amount",
		required: true,
		type: "number",
	},
	{
		field: "progressPercentage",
		label: "Progress Percentage",
		required: true,
		type: "number",
	},
	{
		field: "milestone",
		label: "Milestone",
		type: "number",
		description: "Milestone reached (25, 50, 75, 100)",
	},
	{
		field: "daysRemaining",
		label: "Days Remaining",
		type: "number",
	},
	{
		field: "isOnTrack",
		label: "Is On Track",
		type: "boolean",
	},
];

const GOAL_FIELDS: ConditionFieldDefinition[] = [
	{
		field: "goalType",
		label: "Tipo de Meta",
		type: "string",
		operators: ["eq", "neq", "in", "not_in"],
		valueOptions: [
			{ value: "savings", label: "Poupanca" },
			{ value: "debt_payoff", label: "Quitar Divida" },
			{ value: "spending_limit", label: "Limite de Gastos" },
			{ value: "income_target", label: "Meta de Receita" },
		],
	},
	{
		field: "progressPercentage",
		label: "Progresso (%)",
		type: "number",
		operators: ["eq", "neq", "gt", "lt", "gte", "lte", "between"],
	},
	{
		field: "targetAmount",
		label: "Valor Alvo",
		type: "number",
		operators: ["eq", "neq", "gt", "lt", "gte", "lte", "between"],
	},
	{
		field: "milestone",
		label: "Marco",
		type: "number",
		operators: ["eq", "neq", "gt", "gte"],
		valueOptions: [
			{ value: "25", label: "25%" },
			{ value: "50", label: "50%" },
			{ value: "75", label: "75%" },
			{ value: "100", label: "100%" },
		],
	},
];

export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
   {
      availableFields: TRANSACTION_FIELDS,
      category: "transaction",
      description: "Triggered when a new transaction is created",
      eventDataSchema: TRANSACTION_EVENT_DATA_SCHEMA,
      label: "Transaction Created",
      supportsSimulation: true,
      type: "transaction.created",
   },
   {
      availableFields: TRANSACTION_FIELDS,
      category: "transaction",
      description: "Triggered when an existing transaction is modified",
      eventDataSchema: [
         ...TRANSACTION_EVENT_DATA_SCHEMA,
         {
            description: "The previous values before update",
            field: "previousData",
            label: "Previous Data",
            type: "object",
         },
      ],
      label: "Transaction Updated",
      supportsSimulation: true,
      type: "transaction.updated",
   },
   // Schedule triggers
   {
      availableFields: [],
      category: "scheduled",
      configSchema: SCHEDULE_CONFIG_SCHEMA,
      description: "Executa todos os dias no horario configurado",
      eventDataSchema: SCHEDULE_EVENT_DATA_SCHEMA,
      label: "Diario",
      supportsSimulation: true,
      type: "schedule.daily",
   },
   {
      availableFields: [],
      category: "scheduled",
      configSchema: SCHEDULE_WEEKLY_CONFIG_SCHEMA,
      description: "Executa uma vez por semana no dia e horario configurados",
      eventDataSchema: SCHEDULE_EVENT_DATA_SCHEMA,
      label: "Semanal",
      supportsSimulation: true,
      type: "schedule.weekly",
   },
   {
      availableFields: [],
      category: "scheduled",
      configSchema: SCHEDULE_CONFIG_SCHEMA,
      description: "Executa a cada duas semanas (dias 1 e 15 de cada mes)",
      eventDataSchema: SCHEDULE_EVENT_DATA_SCHEMA,
      label: "Quinzenal",
      supportsSimulation: true,
      type: "schedule.biweekly",
   },
   {
      availableFields: [],
      category: "scheduled",
      configSchema: SCHEDULE_CUSTOM_CONFIG_SCHEMA,
      description: "Executa de acordo com uma expressao cron personalizada",
      eventDataSchema: SCHEDULE_EVENT_DATA_SCHEMA,
      label: "Personalizado",
      supportsSimulation: true,
      type: "schedule.custom",
   },
   // Anomaly triggers
   {
      availableFields: ANOMALY_FIELDS,
      category: "transaction",
      description: "Acionado quando gastos do período estão significativamente acima da média",
      eventDataSchema: ANOMALY_EVENT_DATA_SCHEMA,
      label: "Pico de Gastos Detectado",
      supportsSimulation: false,
      type: "anomaly.spending_spike",
   },
   {
      availableFields: ANOMALY_FIELDS,
      category: "transaction",
      description: "Acionado quando gastos em uma categoria estão fora do padrão",
      eventDataSchema: ANOMALY_EVENT_DATA_SCHEMA,
      label: "Gasto Incomum em Categoria",
      supportsSimulation: false,
      type: "anomaly.unusual_category",
   },
   {
      availableFields: ANOMALY_FIELDS,
      category: "transaction",
      description: "Acionado quando uma transação de valor muito alto é detectada",
      eventDataSchema: ANOMALY_EVENT_DATA_SCHEMA,
      label: "Transação de Alto Valor",
      supportsSimulation: false,
      type: "anomaly.large_transaction",
   },
   // Goal triggers
   {
      availableFields: GOAL_FIELDS,
      category: "transaction",
      description: "Acionado quando uma meta atinge um marco (25%, 50%, 75%, 100%)",
      eventDataSchema: GOAL_EVENT_DATA_SCHEMA,
      label: "Marco de Meta Atingido",
      supportsSimulation: false,
      type: "goal.milestone_reached",
   },
   {
      availableFields: GOAL_FIELDS,
      category: "transaction",
      description: "Acionado quando uma meta está em risco de não ser atingida no prazo",
      eventDataSchema: GOAL_EVENT_DATA_SCHEMA,
      label: "Meta em Risco",
      supportsSimulation: false,
      type: "goal.at_risk",
   },
   {
      availableFields: GOAL_FIELDS,
      category: "transaction",
      description: "Acionado quando uma meta é concluída com sucesso",
      eventDataSchema: GOAL_EVENT_DATA_SCHEMA,
      label: "Meta Concluída",
      supportsSimulation: false,
      type: "goal.completed",
   },
];

export function getTriggerDefinition(
   type: TriggerType,
): TriggerDefinition | undefined {
   return TRIGGER_DEFINITIONS.find((def) => def.type === type);
}

export function getTriggersByCategory(
   category: TriggerDefinition["category"],
): TriggerDefinition[] {
   return TRIGGER_DEFINITIONS.filter((def) => def.category === category);
}

export function getTriggerLabel(type: TriggerType): string {
   return getTriggerDefinition(type)?.label ?? type;
}

export function getFieldsForTrigger(
   type: TriggerType,
): ConditionFieldDefinition[] {
   return getTriggerDefinition(type)?.availableFields ?? [];
}
