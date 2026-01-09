import type {
   ActionConfig,
   ActionType,
   ConditionOperator,
   ConditionType,
   TriggerConfig,
   TriggerType,
} from "@packages/database/schema";
import type { Edge, Node } from "@xyflow/react";

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

export type AutomationFlowState = {
   nodes: AutomationNode[];
   edges: AutomationEdge[];
   selectedNodeId: string | null;
};

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
   "transaction.created": "Transacao Criada",
   "transaction.updated": "Transacao Atualizada",
   "schedule.daily": "Agendamento Diario",
   "schedule.weekly": "Agendamento Semanal",
   "schedule.biweekly": "Agendamento Quinzenal",
   "schedule.custom": "Agendamento Personalizado",
   "budget.threshold_reached": "Limite de Orcamento Atingido",
   "budget.period_end": "Fim de Periodo do Orcamento",
   "budget.overspent": "Orcamento Excedido",
   "anomaly.spending_spike": "Pico de Gastos Detectado",
   "anomaly.unusual_category": "Gasto Incomum em Categoria",
   "anomaly.large_transaction": "Transacao de Alto Valor",
   "goal.milestone_reached": "Marco de Meta Alcancado",
   "goal.at_risk": "Meta em Risco",
   "goal.completed": "Meta Concluida",
};

export const isScheduleTrigger = (type: TriggerType): boolean =>
   type.startsWith("schedule.");

export const isBudgetTrigger = (type: TriggerType): boolean =>
   type.startsWith("budget.");

export const isAnomalyTrigger = (type: TriggerType): boolean =>
   type.startsWith("anomaly.");

export const isGoalTrigger = (type: TriggerType): boolean =>
   type.startsWith("goal.");

export const DAYS_OF_WEEK = [
   { label: "Domingo", value: 0 },
   { label: "Segunda", value: 1 },
   { label: "Terça", value: 2 },
   { label: "Quarta", value: 3 },
   { label: "Quinta", value: 4 },
   { label: "Sexta", value: 5 },
   { label: "Sábado", value: 6 },
] as const;

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
   add_tag: "Adicionar Tag",
   create_transaction: "Criar Transação",
   fetch_bills_report: "Buscar Relatório de Contas",
   format_data: "Formatar Dados",
   mark_as_transfer: "Marcar como Transferência",
   remove_tag: "Remover Tag",
   send_email: "Enviar E-mail",
   send_push_notification: "Enviar Notificação Push",
   set_category: "Definir Categoria",
   set_cost_center: "Definir Centro de Custo",
   stop_execution: "Parar Execução",
   update_description: "Atualizar Descrição",
   generate_custom_report: "Gerar Relatório Personalizado",
   fetch_budget_report: "Buscar Relatório de Orçamentos",
   check_budget_status: "Verificar Status de Orçamentos",
};

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
