import type { WorkflowGraph } from "./schema";

export type WorkflowTemplateId =
   | "dre-monthly"
   | "cash-flow-weekly"
   | "cost-centers-monthly"
   | "aging-weekly"
   | "categories-monthly"
   | "blank-workflow";

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
      id: "dre-monthly",
      name: "DRE mensal",
      icon: "chart-column",
      description: "Gera a DRE automaticamente todo mês.",
      cadence: "monthly",
      defaultCron: "0 9 1 * *",
      reportType: "dre",
      period: "previous-month",
      defaultNameTemplate: "DRE — {month} {year}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 1 * *",
         humanLabel: "Todo dia 1 às 09:00",
         reportType: "dre",
         period: "previous-month",
         nameTemplate: "DRE — {month} {year}",
      }),
   },
   {
      id: "cash-flow-weekly",
      name: "Fluxo de caixa semanal",
      icon: "line-chart",
      description: "Atualiza o fluxo de caixa toda segunda-feira.",
      cadence: "weekly",
      defaultCron: "0 9 * * 1",
      reportType: "cash-flow",
      period: "previous-week",
      defaultNameTemplate: "Fluxo de caixa — semana {week}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 * * 1",
         humanLabel: "Toda segunda às 09:00",
         reportType: "cash-flow",
         period: "previous-week",
         nameTemplate: "Fluxo de caixa — semana {week}",
      }),
   },
   {
      id: "cost-centers-monthly",
      name: "Centro de Custo mensal",
      icon: "badge-dollar-sign",
      description: "Resume despesas por Centro de Custo no mês.",
      cadence: "monthly",
      defaultCron: "0 9 1 * *",
      reportType: "cost-centers",
      period: "previous-month",
      defaultNameTemplate: "Centro de Custo — {month} {year}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 1 * *",
         humanLabel: "Todo dia 1 às 09:00",
         reportType: "cost-centers",
         period: "previous-month",
         nameTemplate: "Centro de Custo — {month} {year}",
      }),
   },
   {
      id: "aging-weekly",
      name: "A receber/pagar semanal",
      icon: "calendar-range",
      description: "Acompanha vencimentos e atrasos semanalmente.",
      cadence: "weekly",
      defaultCron: "0 9 * * 1",
      reportType: "aging",
      period: "current-week",
      defaultNameTemplate: "A receber/pagar — semana {week}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 * * 1",
         humanLabel: "Toda segunda às 09:00",
         reportType: "aging",
         period: "current-week",
         nameTemplate: "A receber/pagar — semana {week}",
      }),
   },
   {
      id: "categories-monthly",
      name: "Despesas por categoria mensal",
      icon: "tags",
      description: "Distribui despesas por categoria todo mês.",
      cadence: "monthly",
      defaultCron: "0 9 1 * *",
      reportType: "categories",
      period: "previous-month",
      defaultNameTemplate: "Despesas por categoria — {month} {year}",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 1 * *",
         humanLabel: "Todo dia 1 às 09:00",
         reportType: "categories",
         period: "previous-month",
         nameTemplate: "Despesas por categoria — {month} {year}",
      }),
   },
   {
      id: "blank-workflow",
      name: "Workflow em branco",
      icon: "workflow",
      description: "Comece do zero com uma agenda base.",
      cadence: "monthly",
      defaultCron: "0 9 1 * *",
      reportType: "dre",
      period: "previous-month",
      defaultNameTemplate: "Novo workflow",
      editableFields: ["schedule"],
      defaultGraph: createTemplateGraph({
         cron: "0 9 1 * *",
         humanLabel: "Todo dia 1 às 09:00",
         reportType: "dre",
         period: "previous-month",
         nameTemplate: "Novo workflow",
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
            position: template.defaultGraph.nodes[0].position,
            data: {
               cron: schedule.cron,
               timezone: "America/Sao_Paulo",
               humanLabel: schedule.humanLabel,
            },
         },
         {
            id: "action",
            type: "createReport",
            position: template.defaultGraph.nodes[1].position,
            data: {
               reportType: template.reportType,
               period: { kind: template.period },
               nameTemplate: template.defaultNameTemplate,
            },
         },
      ],
      edges: template.defaultGraph.edges,
   };
}
