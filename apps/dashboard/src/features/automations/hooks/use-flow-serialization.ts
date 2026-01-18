import {
	type Condition,
	type ConditionGroup,
	isConditionGroup,
} from "@f-o-t/rules-engine";
import type {
	ActionConfig,
	ActionType,
	ConditionOperator,
	ConditionType,
	Consequence,
	FlowData,
	TriggerConfig,
	TriggerType,
} from "@packages/database/schema";
import { getAction } from "@packages/workflows/config/actions";
import type { Edge, Node } from "@xyflow/react";
import { useCallback } from "react";

// ============================================
// Types
// ============================================

export type TriggerNodeData = {
	label: string;
	triggerType: TriggerType;
	config: TriggerConfig;
};

export type ConditionNodeData = {
	label: string;
	operator: "AND" | "OR";
	conditions: {
		id: string;
		type: ConditionType;
		field: string;
		operator: ConditionOperator;
		value?: unknown;
	}[];
};

export type ActionNodeData = {
	label: string;
	actionType: ActionType;
	config: ActionConfig;
	continueOnError?: boolean;
};

export type AutomationNodeData =
	| TriggerNodeData
	| ConditionNodeData
	| ActionNodeData;

export type TriggerNode = Node<TriggerNodeData, "trigger">;
export type ConditionNode = Node<ConditionNodeData, "condition">;
export type ActionNode = Node<ActionNodeData, "action">;

export type AutomationNode = TriggerNode | ConditionNode | ActionNode;
export type AutomationEdge = Edge;

// ============================================
// Label Constants
// ============================================

export const CONDITION_OPERATOR_LABELS: Partial<Record<string, string>> = {
	after: "Depois",
	before: "Antes",
	between: "Entre",
	contains: "Contém",
	contains_all: "Contém Todos",
	contains_any: "Contém Qualquer",
	day_of_month: "Dia do Mês",
	day_of_week: "Dia da Semana",
	ends_with: "Termina Com",
	eq: "=",
	gt: ">",
	gte: "≥",
	in: "Na Lista",
	is_empty: "Está Vazio",
	is_false: "É Falso",
	is_not_empty: "Não Está Vazio",
	is_true: "É Verdadeiro",
	is_weekday: "É Dia de Semana",
	is_weekend: "É Fim de Semana",
	length_eq: "Tamanho =",
	length_gt: "Tamanho >",
	length_lt: "Tamanho <",
	lt: "<",
	lte: "≤",
	matches: "Corresponde a Regex",
	neq: "≠",
	not_between: "Fora do Intervalo",
	not_contains: "Não Contém",
	not_in: "Fora da Lista",
	starts_with: "Começa Com",
};

export const DAYS_OF_WEEK = [
	{ label: "Domingo", value: 0 },
	{ label: "Segunda", value: 1 },
	{ label: "Terça", value: 2 },
	{ label: "Quarta", value: 3 },
	{ label: "Quinta", value: 4 },
	{ label: "Sexta", value: 5 },
	{ label: "Sábado", value: 6 },
] as const;

export const TRANSACTION_FIELDS = [
	{ label: "Descrição", type: "string", value: "description" },
	{ label: "Valor", type: "number", value: "amount" },
	{ label: "Tipo", type: "enum", value: "type" },
	{ label: "Data", type: "date", value: "date" },
	{ label: "Conta Bancária", type: "reference", value: "bankAccountId" },
	{ label: "Categorias", type: "array", value: "categoryIds" },
	{ label: "Centro de Custo", type: "reference", value: "costCenterId" },
	{ label: "Tags", type: "array", value: "tagIds" },
	{ label: "Contraparte", type: "reference", value: "counterpartyId" },
] as const;

export type TransactionField = (typeof TRANSACTION_FIELDS)[number]["value"];

// ============================================
// Utility functions (pure, stateless)
// ============================================

function topologicalSort(
	nodes: AutomationNode[],
	edges: AutomationEdge[],
): AutomationNode[] {
	const nodeIds = new Set(nodes.map((n) => n.id));
	const relevantEdges = edges.filter(
		(e) => nodeIds.has(e.source) && nodeIds.has(e.target),
	);

	const inDegree = new Map<string, number>();
	const adjacency = new Map<string, string[]>();

	for (const node of nodes) {
		inDegree.set(node.id, 0);
		adjacency.set(node.id, []);
	}

	for (const edge of relevantEdges) {
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
		adjacency.get(edge.source)?.push(edge.target);
	}

	const queue: string[] = [];
	for (const [id, degree] of inDegree.entries()) {
		if (degree === 0) {
			queue.push(id);
		}
	}

	const sorted: AutomationNode[] = [];
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	while (queue.length > 0) {
		const id = queue.shift();
		if (!id) continue;
		const node = nodeMap.get(id);
		if (node) {
			sorted.push(node);
		}

		for (const neighbor of adjacency.get(id) ?? []) {
			const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
			inDegree.set(neighbor, newDegree);
			if (newDegree === 0) {
				queue.push(neighbor);
			}
		}
	}

	return sorted;
}

function getActionLabel(actionType: ActionType): string {
	const action = getAction(actionType);
	return action?.label ?? actionType;
}

export function flowDataToNodesAndEdges(
	flowData: FlowData | null | undefined,
): {
	nodes: AutomationNode[];
	edges: AutomationEdge[];
} {
	if (!flowData) {
		return { edges: [], nodes: [] };
	}

	const nodes = (flowData.nodes ?? []) as AutomationNode[];
	const edges = (flowData.edges ?? []) as AutomationEdge[];

	return { edges, nodes };
}

export function nodesToFlowData(
	nodes: AutomationNode[],
	edges: AutomationEdge[],
	viewport?: { x: number; y: number; zoom: number },
): FlowData {
	return {
		edges: edges as unknown[],
		nodes: nodes as unknown[],
		viewport,
	};
}

export function extractRuleDataFromNodes(
	nodes: AutomationNode[],
	edges: AutomationEdge[],
): {
	triggerType: TriggerType;
	triggerConfig: TriggerConfig;
	conditions: ConditionGroup;
	consequences: Consequence[];
} {
	const triggerNodes = nodes.filter((n) => n.type === "trigger");
	const conditionNodes = nodes.filter((n) => n.type === "condition");
	const actionNodes = nodes.filter((n) => n.type === "action");

	if (triggerNodes.length === 0) {
		throw new Error("É necessário pelo menos um nó de gatilho");
	}

	if (actionNodes.length === 0) {
		throw new Error("É necessário pelo menos um nó de ação");
	}

	const triggerNode = triggerNodes[0];
	if (!triggerNode) {
		throw new Error("Nó de gatilho não encontrado");
	}
	const triggerData = triggerNode.data as TriggerNodeData;

	const conditionGroupConditions: (Condition | ConditionGroup)[] =
		conditionNodes.map((node) => {
			const data = node.data as ConditionNodeData;
			return {
				conditions: data.conditions as Condition[],
				id: node.id,
				operator: data.operator,
			};
		});

	const conditions: ConditionGroup = {
		id: crypto.randomUUID(),
		operator: "AND",
		conditions: conditionGroupConditions,
	};

	const orderedActionNodes = topologicalSort(actionNodes, edges);

	const consequences: Consequence[] = orderedActionNodes.map((node) => {
		const data = node.data as ActionNodeData;
		return {
			payload: data.config,
			type: data.actionType,
		};
	});

	return {
		consequences,
		conditions,
		triggerConfig: triggerData.config,
		triggerType: triggerData.triggerType,
	};
}

export function ruleDataToNodes(
	triggerType: TriggerType,
	triggerConfig: TriggerConfig,
	conditions: ConditionGroup | ConditionGroup[],
	consequences: Consequence[],
): { nodes: AutomationNode[]; edges: AutomationEdge[] } {
	const nodes: AutomationNode[] = [];
	const edges: AutomationEdge[] = [];

	const triggerId = `trigger-${crypto.randomUUID()}`;
	nodes.push({
		data: {
			config: triggerConfig,
			label: "Gatilho",
			triggerType,
		},
		id: triggerId,
		position: { x: 250, y: 0 },
		type: "trigger",
	});

	let lastNodeId = triggerId;
	let yPosition = 150;

	const conditionGroups = Array.isArray(conditions)
		? conditions
		: conditions.conditions.filter((c): c is ConditionGroup =>
				isConditionGroup(c),
			);

	for (const condition of conditionGroups) {
		const conditionId = condition.id || `condition-${crypto.randomUUID()}`;
		nodes.push({
			data: {
				conditions: condition.conditions
					.filter((c): c is Condition => !isConditionGroup(c))
					.map((c) => ({
						field: c.field,
						id: c.id,
						operator: c.operator as ConditionOperator,
						type: c.type as ConditionType,
						value: c.value,
					})),
				label: `Condição ${condition.operator}`,
				operator: condition.operator,
			},
			id: conditionId,
			position: { x: 250, y: yPosition },
			type: "condition",
		});

		edges.push({
			id: `edge-${lastNodeId}-${conditionId}`,
			source: lastNodeId,
			sourceHandle: "bottom",
			target: conditionId,
			targetHandle: "top",
		});

		lastNodeId = conditionId;
		yPosition += 150;
	}

	for (const consequence of consequences) {
		const actionId = `action-${crypto.randomUUID()}`;
		nodes.push({
			data: {
				actionType: consequence.type,
				config: consequence.payload,
				label: getActionLabel(consequence.type),
			},
			id: actionId,
			position: { x: 250, y: yPosition },
			type: "action",
		});

		edges.push({
			id: `edge-${lastNodeId}-${actionId}`,
			source: lastNodeId,
			sourceHandle: "bottom",
			target: actionId,
			targetHandle: "top",
		});

		lastNodeId = actionId;
		yPosition += 150;
	}

	return { edges, nodes };
}

export function schemaToFlowData(
	triggerType: TriggerType,
	conditions: ConditionGroup | ConditionGroup[],
	consequences: Consequence[],
	existingFlowData: { nodes: unknown[]; edges: unknown[] } | null,
): { nodes: AutomationNode[]; edges: AutomationEdge[] } {
	if (existingFlowData?.nodes?.length) {
		return flowDataToNodesAndEdges(existingFlowData as FlowData);
	}
	return ruleDataToNodes(triggerType, {}, conditions, consequences);
}

export function flowDataToSchema(
	nodes: AutomationNode[],
	edges: AutomationEdge[],
): {
	conditions: ConditionGroup;
	consequences: Consequence[];
} {
	const result = extractRuleDataFromNodes(nodes, edges);
	return {
		consequences: result.consequences,
		conditions: result.conditions,
	};
}

export function createDefaultTriggerNode(
	triggerType: TriggerType = "transaction.created",
): AutomationNode {
	return {
		data: {
			config: {},
			label: "Gatilho",
			triggerType,
		},
		id: `trigger-${crypto.randomUUID()}`,
		position: { x: 250, y: 0 },
		type: "trigger",
	};
}

export function createDefaultConditionNode(
	operator: "AND" | "OR" = "AND",
	position: { x: number; y: number } = { x: 250, y: 150 },
): AutomationNode {
	return {
		data: {
			conditions: [],
			label: `Condição ${operator}`,
			operator,
		},
		id: `condition-${crypto.randomUUID()}`,
		position,
		type: "condition",
	};
}

export function createDefaultActionNode(
	actionType: ActionType = "set_category",
	config: ActionConfig = {},
	position: { x: number; y: number } = { x: 250, y: 300 },
): AutomationNode {
	return {
		data: {
			actionType,
			config,
			label: getActionLabel(actionType),
		},
		id: `action-${crypto.randomUUID()}`,
		position,
		type: "action",
	};
}

// ============================================
// Hook
// ============================================

export function useFlowSerialization() {
	const schemaToFlowDataCb = useCallback(
		(
			triggerType: TriggerType,
			conditions: ConditionGroup | ConditionGroup[],
			consequences: Consequence[],
			existingFlowData: { nodes: unknown[]; edges: unknown[] } | null,
		) => schemaToFlowData(triggerType, conditions, consequences, existingFlowData),
		[],
	);

	const flowDataToSchemaCb = useCallback(
		(nodes: AutomationNode[], edges: AutomationEdge[]) =>
			flowDataToSchema(nodes, edges),
		[],
	);

	const createDefaultTriggerNodeCb = useCallback(
		(triggerType?: TriggerType) => createDefaultTriggerNode(triggerType),
		[],
	);

	const createDefaultConditionNodeCb = useCallback(
		(operator?: "AND" | "OR", position?: { x: number; y: number }) =>
			createDefaultConditionNode(operator, position),
		[],
	);

	const createDefaultActionNodeCb = useCallback(
		(
			actionType?: ActionType,
			config?: ActionConfig,
			position?: { x: number; y: number },
		) => createDefaultActionNode(actionType, config, position),
		[],
	);

	return {
		schemaToFlowData: schemaToFlowDataCb,
		flowDataToSchema: flowDataToSchemaCb,
		createDefaultTriggerNode: createDefaultTriggerNodeCb,
		createDefaultConditionNode: createDefaultConditionNodeCb,
		createDefaultActionNode: createDefaultActionNodeCb,
		flowDataToNodesAndEdges,
		nodesToFlowData,
		extractRuleDataFromNodes,
		ruleDataToNodes,
	};
}
