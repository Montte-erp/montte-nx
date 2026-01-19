import type { TriggerType } from "@packages/database/schema";
import { isPercentageSumValid } from "@packages/utils/split";
import { getAction } from "@packages/workflows/config/actions";
import { useCallback } from "react";
import type {
   ActionNodeData,
   AutomationEdge,
   AutomationNode,
   ConditionNodeData,
   TriggerNodeData,
} from "./use-flow-serialization";

// ============================================
// Types
// ============================================

export type ValidationResult = {
   valid: boolean;
   errors: string[];
   warnings?: string[];
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

export type ExtendedNodeValidationResult = NodeValidationResult & {
   warnings: string[];
};

export type ExtendedNodesValidationResult = {
   valid: boolean;
   invalidNodes: ExtendedNodeValidationResult[];
   nodesWithWarnings: ExtendedNodeValidationResult[];
};

// ============================================
// Constants
// ============================================

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

// ============================================
// Helper functions
// ============================================

export const isScheduleTrigger = (type: TriggerType): boolean =>
   type.startsWith("schedule.");

export const isBudgetTrigger = (type: TriggerType): boolean =>
   type.startsWith("budget.");

export const isAnomalyTrigger = (type: TriggerType): boolean =>
   type.startsWith("anomaly.");

export const isGoalTrigger = (type: TriggerType): boolean =>
   type.startsWith("goal.");

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

/**
 * Finds all upstream nodes (nodes that can reach the target node)
 */
function findUpstreamNodes(
   nodeId: string,
   nodes: AutomationNode[],
   edges: AutomationEdge[],
   visited = new Set<string>(),
): AutomationNode[] {
   if (visited.has(nodeId)) return [];
   visited.add(nodeId);

   const upstreamNodes: AutomationNode[] = [];
   const incomingEdges = edges.filter((e) => e.target === nodeId);

   for (const edge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode) {
         upstreamNodes.push(sourceNode);
         upstreamNodes.push(
            ...findUpstreamNodes(sourceNode.id, nodes, edges, visited),
         );
      }
   }

   return upstreamNodes;
}

// ============================================
// Validation functions
// ============================================

export function validateActionNode(data: ActionNodeData): ValidationResult {
   const errors: string[] = [];
   const definition = getAction(data.actionType);

   if (!definition) {
      return { errors: ["Tipo de ação desconhecido"], valid: false };
   }

   if (data.actionType === "set_category") {
      const setCategoryErrors = validateSetCategoryAction(data.config);
      errors.push(...setCategoryErrors);
   } else {
      for (const field of definition.fields) {
         if (!field.required) continue;

         const configRecord = data.config as Record<string, unknown>;

         if (field.dependsOn) {
            const dependencyValue = configRecord[field.dependsOn.field];
            if (dependencyValue !== field.dependsOn.value) {
               continue;
            }
         }

         const value = configRecord[field.key];
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

      if (data.triggerType === "schedule.custom" && !data.config?.cronPattern) {
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

/**
 * Validates data flow dependencies for an action node
 */
export function validateDataDependencies(
   nodeId: string,
   data: ActionNodeData,
   allNodes: AutomationNode[],
   edges: AutomationEdge[],
): { valid: boolean; warnings: string[] } {
   const warnings: string[] = [];
   const actionDef = getAction(data.actionType);
   const dataFlow = actionDef.dataFlow;

   if (!dataFlow?.requires) {
      return { valid: true, warnings: [] };
   }

   const upstreamNodes = findUpstreamNodes(nodeId, allNodes, edges);
   const upstreamActionNodes = upstreamNodes.filter(
      (n): n is AutomationNode & { type: "action"; data: ActionNodeData } =>
         n.type === "action",
   );

   const hasRequiredData = upstreamActionNodes.some((n) => {
      const upstreamDef = getAction(n.data.actionType);
      return upstreamDef.dataFlow?.produces === dataFlow.requires;
   });

   if (!hasRequiredData) {
      warnings.push(
         `Esta ação requer "${dataFlow.requiresLabel ?? dataFlow.requires}" de uma ação anterior. Conecte uma ação que produza esses dados.`,
      );
   }

   return { valid: warnings.length === 0, warnings };
}

/**
 * Validates attachment dependency for send_email action
 */
export function validateEmailAttachmentDependency(
   nodeId: string,
   data: ActionNodeData,
   allNodes: AutomationNode[],
   edges: AutomationEdge[],
): { valid: boolean; warnings: string[] } {
   if (data.actionType !== "send_email") {
      return { valid: true, warnings: [] };
   }

   const config = data.config as Record<string, unknown>;
   if (!config.includeAttachment) {
      return { valid: true, warnings: [] };
   }

   const upstreamNodes = findUpstreamNodes(nodeId, allNodes, edges);
   const upstreamActionNodes = upstreamNodes.filter(
      (n): n is AutomationNode & { type: "action"; data: ActionNodeData } =>
         n.type === "action",
   );

   const hasFormatData = upstreamActionNodes.some(
      (n) => n.data.actionType === "format_data",
   );

   if (!hasFormatData) {
      return {
         valid: false,
         warnings: [
            'Anexo habilitado, mas nenhuma ação "Formatar Dados" foi encontrada antes deste nó. Adicione uma ação "Formatar Dados" para gerar o anexo.',
         ],
      };
   }

   return { valid: true, warnings: [] };
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

/**
 * Extended validation that includes data flow dependency checks
 */
export function validateAllNodesWithDependencies(
   nodes: AutomationNode[],
   edges: AutomationEdge[],
): ExtendedNodesValidationResult {
   const invalidNodes: ExtendedNodeValidationResult[] = [];
   const nodesWithWarnings: ExtendedNodeValidationResult[] = [];

   for (const node of nodes) {
      let errors: string[] = [];
      const warnings: string[] = [];
      let nodeLabel = "";
      let nodeType = "";

      if (node.type === "trigger") {
         const data = node.data as TriggerNodeData;
         const validation = validateTriggerNode(data);
         errors = validation.errors;
         nodeLabel = data.label;
         nodeType = "trigger";
      } else if (node.type === "action") {
         const data = node.data as ActionNodeData;
         const validation = validateActionNode(data);
         errors = validation.errors;
         nodeLabel = data.label;
         nodeType = "action";

         const depValidation = validateDataDependencies(
            node.id,
            data,
            nodes,
            edges,
         );
         warnings.push(...depValidation.warnings);

         const attachmentValidation = validateEmailAttachmentDependency(
            node.id,
            data,
            nodes,
            edges,
         );
         warnings.push(...attachmentValidation.warnings);
      } else if (node.type === "condition") {
         const data = node.data as ConditionNodeData;
         const validation = validateConditionNode(data);
         errors = validation.errors;
         nodeLabel = data.label;
         nodeType = "condition";
      }

      if (errors.length > 0) {
         invalidNodes.push({
            nodeId: node.id,
            nodeLabel,
            nodeType,
            errors,
            warnings,
         });
      } else if (warnings.length > 0) {
         nodesWithWarnings.push({
            nodeId: node.id,
            nodeLabel,
            nodeType,
            errors: [],
            warnings,
         });
      }
   }

   return {
      valid: invalidNodes.length === 0,
      invalidNodes,
      nodesWithWarnings,
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

// ============================================
// Hook
// ============================================

export function useNodeValidation() {
   const validateActionNodeCb = useCallback(
      (data: ActionNodeData) => validateActionNode(data),
      [],
   );

   const validateConditionNodeCb = useCallback(
      (data: ConditionNodeData) => validateConditionNode(data),
      [],
   );

   const validateTriggerNodeCb = useCallback(
      (data: TriggerNodeData) => validateTriggerNode(data),
      [],
   );

   const validateAllNodesCb = useCallback(
      (nodes: AutomationNode[]) => validateAllNodes(nodes),
      [],
   );

   const validateAllNodesWithDependenciesCb = useCallback(
      (nodes: AutomationNode[], edges: AutomationEdge[]) =>
         validateAllNodesWithDependencies(nodes, edges),
      [],
   );

   const validateDataDependenciesCb = useCallback(
      (
         nodeId: string,
         data: ActionNodeData,
         allNodes: AutomationNode[],
         edges: AutomationEdge[],
      ) => validateDataDependencies(nodeId, data, allNodes, edges),
      [],
   );

   const validateEmailAttachmentDependencyCb = useCallback(
      (
         nodeId: string,
         data: ActionNodeData,
         allNodes: AutomationNode[],
         edges: AutomationEdge[],
      ) => validateEmailAttachmentDependency(nodeId, data, allNodes, edges),
      [],
   );

   return {
      validateActionNode: validateActionNodeCb,
      validateConditionNode: validateConditionNodeCb,
      validateTriggerNode: validateTriggerNodeCb,
      validateAllNodes: validateAllNodesCb,
      validateAllNodesWithDependencies: validateAllNodesWithDependenciesCb,
      validateDataDependencies: validateDataDependenciesCb,
      validateEmailAttachmentDependency: validateEmailAttachmentDependencyCb,
      getValidationErrorsSummary,
   };
}
