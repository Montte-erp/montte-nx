import { isPercentageSumValid } from "@packages/utils/split";
import { ACTION_DEFINITIONS } from "@packages/workflows/types/actions";
import type {
   ActionNodeData,
   AutomationNode,
   ConditionNodeData,
   TriggerNodeData,
} from "./types";
import { isScheduleTrigger } from "./types";

export type ValidationResult = {
   valid: boolean;
   errors: string[];
};

export type NodeValidationResult = {
   nodeId: string;
   nodeLabel: string;
   nodeType: string;
   errors: string[];
};

export type NodesValidationResult = {
   valid: boolean;
   invalidNodes: NodeValidationResult[];
};

const OPERATORS_WITHOUT_VALUE = new Set([
   "is_empty",
   "is_not_empty",
   "is_true",
   "is_false",
   "is_weekend",
   "is_weekday",
]);

const ACTION_FIELD_LABELS: Record<string, string> = {
   bankAccountId: "Conta Bancária",
   body: "Corpo",
   categoryId: "Categoria",
   categoryIds: "Categorias",
   categorySplitMode: "Modo de Divisão",
   categorySplits: "Valores da Divisão",
   costCenterId: "Centro de Custo",
   customEmail: "E-mail Personalizado",
   description: "Descrição",
   dynamicSplitPattern: "Padrão de Extração",
   mode: "Modo",
   subject: "Assunto",
   tagIds: "Tags",
   title: "Título",
   to: "Destinatário",
   toBankAccountId: "Conta Destino",
   type: "Tipo",
   value: "Valor",
};

function getFieldLabel(key: string): string {
   return ACTION_FIELD_LABELS[key] ?? key;
}

function isFieldEmpty(value: unknown): boolean {
   if (value === undefined || value === null) return true;
   if (typeof value === "string" && value.trim() === "") return true;
   if (Array.isArray(value) && value.length === 0) return true;
   return false;
}

function validateSetCategoryAction(config: ActionNodeData["config"]): string[] {
   const errors: string[] = [];
   const { categoryId, categoryIds, categorySplitMode, categorySplits } =
      config;

   const mode = categorySplitMode ?? "equal";
   const isDynamicMode = mode === "dynamic";

   const hasCategories = categoryId || (categoryIds && categoryIds.length > 0);

   if (!hasCategories && !isDynamicMode) {
      errors.push(
         "Selecione pelo menos uma categoria (exceto no modo dinâmico)",
      );
   }

   if (
      (mode === "percentage" || mode === "fixed") &&
      categoryIds &&
      categoryIds.length > 1
   ) {
      if (!categorySplits || categorySplits.length === 0) {
         errors.push("Defina os valores de divisão para cada categoria");
      } else if (mode === "percentage") {
         if (!isPercentageSumValid(categorySplits)) {
            const sum = categorySplits.reduce((acc, s) => acc + s.value, 0);
            errors.push(
               `A soma dos percentuais deve ser 100% (atual: ${sum}%)`,
            );
         }
      }
   }

   return errors;
}

export function validateActionNode(data: ActionNodeData): ValidationResult {
   const errors: string[] = [];
   const definition = ACTION_DEFINITIONS.find(
      (def) => def.type === data.actionType,
   );

   if (!definition) {
      return { errors: ["Tipo de ação desconhecido"], valid: false };
   }

   if (data.actionType === "set_category") {
      const setCategoryErrors = validateSetCategoryAction(data.config);
      errors.push(...setCategoryErrors);
   } else if (data.actionType === "send_bills_digest") {
      // Validate send_bills_digest specific rules
      const includePending = data.config.includePending ?? true;
      const includeOverdue = data.config.includeOverdue ?? true;

      if (!includePending && !includeOverdue) {
         errors.push(
            "Selecione ao menos um tipo de conta (pendentes ou vencidas)",
         );
      }

      const billTypes = data.config.billTypes as string[] | undefined;
      if (!billTypes || billTypes.length === 0) {
         errors.push("Selecione ao menos um tipo de conta");
      }
   } else {
      for (const field of definition.configSchema) {
         if (!field.required) continue;

         if (field.dependsOn) {
            const dependencyValue = data.config[field.dependsOn.field];
            if (dependencyValue !== field.dependsOn.value) {
               continue;
            }
         }

         const value = data.config[field.key];
         if (isFieldEmpty(value)) {
            errors.push(`${getFieldLabel(field.key)} é obrigatório`);
         }
      }
   }

   return {
      errors,
      valid: errors.length === 0,
   };
}

export function validateConditionNode(
   data: ConditionNodeData,
): ValidationResult {
   const errors: string[] = [];

   if (data.conditions.length === 0) {
      errors.push("Adicione pelo menos uma condição");
      return { errors, valid: false };
   }

   for (let i = 0; i < data.conditions.length; i++) {
      const condition = data.conditions[i];
      if (!condition) continue;

      if (!OPERATORS_WITHOUT_VALUE.has(condition.operator)) {
         if (isFieldEmpty(condition.value)) {
            errors.push(`Condição ${i + 1}: valor é obrigatório`);
         }
      }
   }

   return {
      errors,
      valid: errors.length === 0,
   };
}

export function validateTriggerNode(data: TriggerNodeData): ValidationResult {
   const errors: string[] = [];

   if (isScheduleTrigger(data.triggerType)) {
      if (!data.config?.time) {
         errors.push("Horário é obrigatório para triggers agendados");
      }

      if (!data.config?.timezone) {
         errors.push("Fuso horário é obrigatório para triggers agendados");
      }

      if (
         data.triggerType === "schedule.custom" &&
         !data.config?.cronPattern
      ) {
         errors.push(
            "Padrão CRON é obrigatório para agendamento personalizado",
         );
      }
   }

   return {
      errors,
      valid: errors.length === 0,
   };
}

export function validateAllNodes(
   nodes: AutomationNode[],
): NodesValidationResult {
   const invalidNodes: NodeValidationResult[] = [];

   for (const node of nodes) {
      if (node.type === "trigger") {
         const data = node.data as TriggerNodeData;
         const validation = validateTriggerNode(data);
         if (!validation.valid) {
            invalidNodes.push({
               errors: validation.errors,
               nodeId: node.id,
               nodeLabel: data.label,
               nodeType: "trigger",
            });
         }
      } else if (node.type === "action") {
         const data = node.data as ActionNodeData;
         const validation = validateActionNode(data);
         if (!validation.valid) {
            invalidNodes.push({
               errors: validation.errors,
               nodeId: node.id,
               nodeLabel: data.label,
               nodeType: "action",
            });
         }
      } else if (node.type === "condition") {
         const data = node.data as ConditionNodeData;
         const validation = validateConditionNode(data);
         if (!validation.valid) {
            invalidNodes.push({
               errors: validation.errors,
               nodeId: node.id,
               nodeLabel: data.label,
               nodeType: "condition",
            });
         }
      }
   }

   return {
      invalidNodes,
      valid: invalidNodes.length === 0,
   };
}

export function getValidationErrorsSummary(
   result: NodesValidationResult,
): string {
   if (result.valid) return "";

   const nodeCount = result.invalidNodes.length;
   const errorCount = result.invalidNodes.reduce(
      (acc, node) => acc + node.errors.length,
      0,
   );

   if (nodeCount === 1) {
      const node = result.invalidNodes[0];
      if (!node) return "";
      return `"${node.nodeLabel}" está incompleto: ${node.errors.join(", ")}`;
   }

   return `${nodeCount} nodes com configuração incompleta (${errorCount} erro${errorCount > 1 ? "s" : ""})`;
}
