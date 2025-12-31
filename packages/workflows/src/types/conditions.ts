import type {
   ArrayOperator,
   BooleanOperator,
   Condition,
   ConditionGroup,
   DateOperator,
   EvaluationContext,
   EvaluationResult,
   GroupEvaluationResult,
   LogicalOperator,
   NumberOperator,
   StringOperator,
} from "@f-o-t/rules-engine";
import type { ConditionOperator, ConditionType } from "@packages/database/schema";

export type {
   ArrayOperator,
   BooleanOperator,
   Condition,
   ConditionGroup,
   ConditionOperator,
   ConditionType,
   DateOperator,
   EvaluationContext,
   EvaluationResult,
   GroupEvaluationResult,
   LogicalOperator,
   NumberOperator,
   StringOperator,
};

export type ConditionFieldDefinition = {
   field: string;
   label: string;
   type: ConditionType;
   description?: string;
   operators: ConditionOperator[];
   valueOptions?: { value: string; label: string }[];
   placeholder?: string;
   helpText?: string;
};

export const TRANSACTION_FIELDS: ConditionFieldDefinition[] = [
   {
      description: "The transaction description text",
      field: "description",
      helpText: "Matches against the raw description",
      label: "Description",
      operators: [
         "eq",
         "neq",
         "contains",
         "not_contains",
         "starts_with",
         "ends_with",
         "matches",
         "is_empty",
         "is_not_empty",
      ],
      type: "string",
   },
   {
      description: "The transaction amount",
      field: "amount",
      label: "Amount",
      operators: [
         "eq",
         "neq",
         "gt",
         "gte",
         "lt",
         "lte",
         "between",
         "not_between",
      ],
      type: "number",
   },
   {
      description: "The type of transaction",
      field: "type",
      label: "Type",
      operators: ["eq", "neq"],
      type: "string",
      valueOptions: [
         { label: "Income", value: "income" },
         { label: "Expense", value: "expense" },
         { label: "Transfer", value: "transfer" },
      ],
   },
   {
      description: "The transaction date",
      field: "date",
      label: "Date",
      operators: [
         "eq",
         "neq",
         "before",
         "after",
         "between",
         "not_between",
         "is_weekend",
         "is_weekday",
         "day_of_week",
         "day_of_month",
      ],
      type: "date",
   },
   {
      description: "Bank account identifier",
      field: "bankAccountId",
      helpText: "Select a bank account to match",
      label: "Bank Account",
      operators: ["eq", "neq", "is_empty", "is_not_empty"],
      type: "string",
   },
   {
      description: "Cost center identifier",
      field: "costCenterId",
      helpText: "Select a cost center to match",
      label: "Cost Center",
      operators: ["eq", "neq", "is_empty", "is_not_empty"],
      type: "string",
   },
   {
      description: "Tags assigned to the transaction",
      field: "tagIds",
      helpText: "Check for specific tags",
      label: "Tags",
      operators: [
         "contains",
         "not_contains",
         "contains_any",
         "contains_all",
         "is_empty",
         "is_not_empty",
      ],
      type: "array",
   },
   {
      description: "Categories assigned to the transaction",
      field: "categoryIds",
      helpText: "Check for specific categories",
      label: "Categories",
      operators: [
         "contains",
         "not_contains",
         "contains_any",
         "contains_all",
         "is_empty",
         "is_not_empty",
      ],
      type: "array",
   },
   {
      description: "Counterparty identifier",
      field: "counterpartyId",
      helpText: "The merchant or person involved",
      label: "Counterparty",
      operators: ["eq", "neq", "is_empty", "is_not_empty"],
      type: "string",
   },
];

export function getFieldDefinition(
   field: string,
): ConditionFieldDefinition | undefined {
   return TRANSACTION_FIELDS.find((f) => f.field === field);
}

export function getFieldsForType(
   type: ConditionType,
): ConditionFieldDefinition[] {
   return TRANSACTION_FIELDS.filter((f) => f.type === type);
}

export function getOperatorsForField(field: string): ConditionOperator[] {
   const definition = getFieldDefinition(field);
   return definition?.operators ?? [];
}
