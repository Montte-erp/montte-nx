import type { WorkflowGraph } from "@core/database/schemas/workflows";

export type WorkflowTemplateId =
   | "blank"
   | "dre-monthly"
   | "cash-flow-weekly"
   | "cost-centers-monthly"
   | "aging-weekly"
   | "categories-monthly";

export type WorkflowTemplatePeriod =
   | "previous-month"
   | "previous-week"
   | "current-month"
   | "current-week";

export type WorkflowTemplate = {
   id: WorkflowTemplateId;
   name: string;
   icon: string;
   description: string;
   category: "blank" | "reports";
   cadence: "weekly" | "monthly";
   defaultCron: string;
   reportType: WorkflowGraph["nodes"][1]["data"]["reportType"];
   period: WorkflowTemplatePeriod;
   defaultNameTemplate: string;
   editableFields: ["schedule"];
   defaultGraph: WorkflowGraph;
};

function createTemplateGraph(input: {
   cron: string;
   humanLabel: string;
   reportType: WorkflowTemplate["reportType"];
   period: WorkflowTemplatePeriod;
   nameTemplate: string;
}): WorkflowGraph {
   return {
      nodes: [
         {
            id: "trigger",
            type: "scheduleTrigger",
            position: { x: 0, y: 0 },
            data: {
               cron: input.cron,
               timezone: "America/Sao_Paulo",
               humanLabel: input.humanLabel,
            },
         },
         {
            id: "action",
            type: "createReport",
            position: { x: 0, y: 176 },
            data: {
               reportType: input.reportType,
               period: { kind: input.period },
               nameTemplate: input.nameTemplate,
            },
         },
      ],
      edges: [
         {
            id: "e-trigger-action",
            source: "trigger",
            target: "action",
         },
      ],
   };
}

export const workflowTemplates = [
   {
      id: "blank",
      name: "Automação em branco",
      icon: "plus",
      description:
         "Crie uma automação pausada para definir agenda e relatório depois.",
      category: "blank",
      cadence: "monthly",
      defaultCron: "0 9 1 * *",
      reportType: "dre",
      period: "previous-month",
      defaultNameTemplate: "Automação em branco",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 1 * *",
         humanLabel: "Todo dia 1 às 09:00",
         reportType: "dre",
         period: "previous-month",
         nameTemplate: "Automação em branco",
      }),
   },
   {
      id: "dre-monthly",
      name: "DRE mensal",
      icon: "chart-column",
      description: "Gere a DRE do mês anterior todo dia 1.",
      category: "reports",
      cadence: "monthly",
      defaultCron: "0 9 1 * *",
      reportType: "dre",
      period: "previous-month",
      defaultNameTemplate: "DRE - {month} {year}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 1 * *",
         humanLabel: "Todo dia 1 às 09:00",
         reportType: "dre",
         period: "previous-month",
         nameTemplate: "DRE - {month} {year}",
      }),
   },
   {
      id: "cash-flow-weekly",
      name: "Fluxo de caixa semanal",
      icon: "line-chart",
      description:
         "Gere o fluxo de caixa da semana anterior toda segunda-feira.",
      category: "reports",
      cadence: "weekly",
      defaultCron: "0 9 * * 1",
      reportType: "cash-flow",
      period: "previous-week",
      defaultNameTemplate: "Fluxo de caixa - semana {week}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 * * 1",
         humanLabel: "Toda segunda às 09:00",
         reportType: "cash-flow",
         period: "previous-week",
         nameTemplate: "Fluxo de caixa - semana {week}",
      }),
   },
   {
      id: "cost-centers-monthly",
      name: "Despesas por Centro de Custo",
      icon: "badge-dollar-sign",
      description:
         "Acompanhe despesas por Centro de Custo no fechamento mensal.",
      category: "reports",
      cadence: "monthly",
      defaultCron: "0 9 1 * *",
      reportType: "cost-centers",
      period: "previous-month",
      defaultNameTemplate: "Centro de Custo - {month} {year}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 1 * *",
         humanLabel: "Todo dia 1 às 09:00",
         reportType: "cost-centers",
         period: "previous-month",
         nameTemplate: "Centro de Custo - {month} {year}",
      }),
   },
   {
      id: "aging-weekly",
      name: "A receber/pagar semanal",
      icon: "calendar-range",
      description:
         "Revise contas a receber, a pagar, vencimentos e atrasos toda semana.",
      category: "reports",
      cadence: "weekly",
      defaultCron: "0 9 * * 1",
      reportType: "aging",
      period: "current-week",
      defaultNameTemplate: "A receber/pagar - semana {week}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 * * 1",
         humanLabel: "Toda segunda às 09:00",
         reportType: "aging",
         period: "current-week",
         nameTemplate: "A receber/pagar - semana {week}",
      }),
   },
   {
      id: "categories-monthly",
      name: "Despesas por categoria",
      icon: "tags",
      description:
         "Veja a distribuição de despesas por categoria no fechamento mensal.",
      category: "reports",
      cadence: "monthly",
      defaultCron: "0 9 1 * *",
      reportType: "categories",
      period: "previous-month",
      defaultNameTemplate: "Despesas por categoria - {month} {year}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 1 * *",
         humanLabel: "Todo dia 1 às 09:00",
         reportType: "categories",
         period: "previous-month",
         nameTemplate: "Despesas por categoria - {month} {year}",
      }),
   },
] satisfies readonly WorkflowTemplate[];

export function getWorkflowTemplate(templateId: string) {
   return workflowTemplates.find((template) => template.id === templateId);
}

export function createWorkflowGraphFromTemplate(
   template: WorkflowTemplate,
   schedule: { cron: string; humanLabel: string },
): WorkflowGraph {
   return {
      nodes: [
         {
            id: "trigger",
            type: "scheduleTrigger",
            position: {
               x: template.defaultGraph.nodes[0].position.x,
               y: template.defaultGraph.nodes[0].position.y,
            },
            data: {
               cron: schedule.cron,
               timezone: "America/Sao_Paulo",
               humanLabel: schedule.humanLabel,
            },
         },
         {
            id: "action",
            type: "createReport",
            position: {
               x: template.defaultGraph.nodes[1].position.x,
               y: template.defaultGraph.nodes[1].position.y,
            },
            data: {
               reportType: template.reportType,
               period: { kind: template.period },
               nameTemplate: template.defaultNameTemplate,
            },
         },
      ],
      edges: [
         {
            id: template.defaultGraph.edges[0].id,
            source: template.defaultGraph.edges[0].source,
            target: template.defaultGraph.edges[0].target,
         },
      ],
   };
}
