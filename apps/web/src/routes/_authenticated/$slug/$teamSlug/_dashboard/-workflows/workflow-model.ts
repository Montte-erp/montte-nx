import type {
   WorkflowGraph,
   WorkflowPeriodKind,
   WorkflowReportNode,
   WorkflowReportType,
   WorkflowRow,
   WorkflowScheduleNode,
} from "@/integrations/tanstack-db/workflows";

export const REPORT_TYPE_VALUES: readonly [
   WorkflowReportType,
   WorkflowReportType,
   WorkflowReportType,
   WorkflowReportType,
   WorkflowReportType,
] = ["dre", "cash-flow", "cost-centers", "aging", "categories"];

export const PERIOD_KIND_VALUES: readonly [
   WorkflowPeriodKind,
   WorkflowPeriodKind,
   WorkflowPeriodKind,
   WorkflowPeriodKind,
] = ["previous-month", "previous-week", "current-month", "current-week"];

export const REPORT_LABELS: Record<WorkflowReportType, string> = {
   dre: "DRE",
   "cash-flow": "Fluxo de caixa",
   "cost-centers": "Despesas por Centro de Custo",
   aging: "A receber/pagar",
   categories: "Despesas por categoria",
};

export const PERIOD_LABELS: Record<WorkflowPeriodKind, string> = {
   "previous-month": "Mês anterior",
   "previous-week": "Semana anterior",
   "current-month": "Mês atual",
   "current-week": "Semana atual",
};

const BLANK_WORKFLOW_NAME_TEMPLATES = ["Automação em branco", "Workflow vazio"];

export function parseWorkflowReportType(value: string): WorkflowReportType {
   return REPORT_TYPE_VALUES.find((item) => item === value) ?? "dre";
}

export function parseWorkflowPeriodKind(value: string): WorkflowPeriodKind {
   return PERIOD_KIND_VALUES.find((item) => item === value) ?? "previous-month";
}

export function getWorkflowScheduleNode(
   graph: WorkflowGraph,
): WorkflowScheduleNode | null {
   return (
      graph.nodes.find(
         (node): node is WorkflowScheduleNode =>
            node.type === "scheduleTrigger",
      ) ?? null
   );
}

export function getWorkflowReportNode(
   graph: WorkflowGraph,
): WorkflowReportNode | null {
   return (
      graph.nodes.find(
         (node): node is WorkflowReportNode => node.type === "createReport",
      ) ?? null
   );
}

export function isBlankWorkflowStub(
   workflow: Pick<WorkflowRow, "graph" | "templateId">,
) {
   const scheduleNode = getWorkflowScheduleNode(workflow.graph);
   const reportNode = getWorkflowReportNode(workflow.graph);
   if (!scheduleNode || !reportNode) return false;

   return (
      workflow.templateId === "blank" &&
      scheduleNode.data.cron === "0 9 1 * *" &&
      scheduleNode.data.timezone === "America/Sao_Paulo" &&
      scheduleNode.data.humanLabel === "Todo dia 1 às 09:00" &&
      reportNode.data.reportType === "dre" &&
      reportNode.data.period.kind === "previous-month" &&
      BLANK_WORKFLOW_NAME_TEMPLATES.includes(reportNode.data.nameTemplate)
   );
}
