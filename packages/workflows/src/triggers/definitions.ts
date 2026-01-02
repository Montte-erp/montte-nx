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
