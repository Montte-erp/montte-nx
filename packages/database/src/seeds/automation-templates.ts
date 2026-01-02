import type { ConditionGroup } from "@f-o-t/rules-engine";
import type { DatabaseInstance } from "../client";
import { upsertSystemTemplate } from "../repositories/automation-template-repository";
import type { TemplateCategory } from "../schemas/automation-templates";
import type {
   Consequence,
   FlowData,
   TriggerConfig,
   TriggerType,
} from "../schemas/automations";

// ============================================
// Flow Data Generation Helpers
// ============================================

type NodeBase = {
   id: string;
   position: { x: number; y: number };
   type: "trigger" | "action" | "condition";
};

type TriggerNode = NodeBase & {
   type: "trigger";
   data: {
      label: string;
      triggerType: TriggerType;
      config: TriggerConfig;
   };
};

type ActionNode = NodeBase & {
   type: "action";
   data: {
      label: string;
      actionType: string;
      config: Record<string, unknown>;
   };
};

type AutomationNode = TriggerNode | ActionNode;

type AutomationEdge = {
   id: string;
   source: string;
   target: string;
   sourceHandle: string;
   targetHandle: string;
};

function generateFlowData(
   triggerType: TriggerType,
   triggerConfig: TriggerConfig,
   actions: Array<{
      type: string;
      label: string;
      config: Record<string, unknown>;
   }>,
): FlowData {
   const nodes: AutomationNode[] = [];
   const edges: AutomationEdge[] = [];

   // Create trigger node
   const triggerId = "trigger-template-1";
   nodes.push({
      id: triggerId,
      position: { x: 250, y: 0 },
      type: "trigger",
      data: {
         label: "Gatilho",
         triggerType,
         config: triggerConfig,
      },
   });

   let lastNodeId = triggerId;
   let yPosition = 150;

   // Create action nodes
   actions.forEach((action, index) => {
      const actionId = `action-template-${index + 1}`;
      nodes.push({
         id: actionId,
         position: { x: 250, y: yPosition },
         type: "action",
         data: {
            label: action.label,
            actionType: action.type,
            config: action.config,
         },
      });

      edges.push({
         id: `edge-${lastNodeId}-${actionId}`,
         source: lastNodeId,
         target: actionId,
         sourceHandle: "bottom",
         targetHandle: "top",
      });

      lastNodeId = actionId;
      yPosition += 150;
   });

   return {
      nodes: nodes as unknown[],
      edges: edges as unknown[],
      viewport: { x: 0, y: 0, zoom: 1 },
   };
}

// ============================================
// System Templates
// ============================================

type SystemTemplate = {
   name: string;
   description: string;
   category: TemplateCategory;
   icon: string;
   tags: string[];
   triggerType: TriggerType;
   triggerConfig: TriggerConfig;
   conditions: ConditionGroup;
   consequences: Consequence[];
   flowData: FlowData;
};

const SYSTEM_TEMPLATES: SystemTemplate[] = [
   // Weekly Bills Digest
   {
      name: "Resumo Semanal de Contas",
      description:
         "Envia um e-mail semanal com o resumo das contas a pagar e receber dos proximos dias",
      category: "bill_management",
      icon: "ClipboardList",
      tags: ["contas", "semanal", "email", "relatorio"],
      triggerType: "schedule.weekly",
      triggerConfig: {
         time: "09:00",
         timezone: "America/Sao_Paulo",
         dayOfWeek: 1, // Monday
      } as TriggerConfig,
      conditions: {
         id: "root",
         operator: "AND",
         conditions: [],
      },
      consequences: [
         {
            type: "fetch_bills_report",
            payload: {
               includePending: true,
               includeOverdue: true,
               daysAhead: 7,
               billTypes: ["expense", "income"],
            },
         },
         {
            type: "send_email",
            payload: {
               to: "owner",
               useTemplate: "bills_digest",
            },
         },
      ],
      flowData: generateFlowData(
         "schedule.weekly",
         {
            time: "09:00",
            timezone: "America/Sao_Paulo",
            dayOfWeek: 1,
         } as TriggerConfig,
         [
            {
               type: "fetch_bills_report",
               label: "Buscar Relatorio de Contas",
               config: {
                  includePending: true,
                  includeOverdue: true,
                  daysAhead: 7,
                  billTypes: ["expense", "income"],
               },
            },
            {
               type: "send_email",
               label: "Enviar E-mail",
               config: {
                  to: "owner",
                  useTemplate: "bills_digest",
               },
            },
         ],
      ),
   },

   // Daily Overdue Bills Alert
   {
      name: "Alerta Diario de Contas Vencidas",
      description: "Envia uma notificacao diaria se houver contas vencidas",
      category: "bill_management",
      icon: "Bell",
      tags: ["contas", "vencidas", "diario", "alerta"],
      triggerType: "schedule.daily",
      triggerConfig: {
         time: "08:00",
         timezone: "America/Sao_Paulo",
      } as TriggerConfig,
      conditions: {
         id: "root",
         operator: "AND",
         conditions: [],
      },
      consequences: [
         {
            type: "fetch_bills_report",
            payload: {
               includePending: false,
               includeOverdue: true,
               daysAhead: 0,
               billTypes: ["expense"],
            },
         },
         {
            type: "send_push_notification",
            payload: {
               title: "Contas Vencidas",
               body: "Voce tem contas vencidas que precisam de atencao",
            },
         },
      ],
      flowData: generateFlowData(
         "schedule.daily",
         {
            time: "08:00",
            timezone: "America/Sao_Paulo",
         } as TriggerConfig,
         [
            {
               type: "fetch_bills_report",
               label: "Buscar Contas Vencidas",
               config: {
                  includePending: false,
                  includeOverdue: true,
                  daysAhead: 0,
                  billTypes: ["expense"],
               },
            },
            {
               type: "send_push_notification",
               label: "Enviar Notificacao",
               config: {
                  title: "Contas Vencidas",
                  body: "Voce tem contas vencidas que precisam de atencao",
               },
            },
         ],
      ),
   },

   // Weekly Bills Report with CSV Attachment
   {
      name: "Relatorio Semanal em CSV",
      description:
         "Gera e envia um relatorio CSV das contas da semana por e-mail",
      category: "reporting",
      icon: "FileBarChart",
      tags: ["relatorio", "csv", "semanal", "email"],
      triggerType: "schedule.weekly",
      triggerConfig: {
         time: "18:00",
         timezone: "America/Sao_Paulo",
         dayOfWeek: 5, // Friday
      } as TriggerConfig,
      conditions: {
         id: "root",
         operator: "AND",
         conditions: [],
      },
      consequences: [
         {
            type: "fetch_bills_report",
            payload: {
               includePending: true,
               includeOverdue: true,
               daysAhead: 7,
               billTypes: ["expense", "income"],
            },
         },
         {
            type: "format_data",
            payload: {
               outputFormat: "csv",
               fileName: "relatorio_contas_{{date}}",
               csvIncludeHeaders: true,
               csvDelimiter: ";",
            },
         },
         {
            type: "send_email",
            payload: {
               to: "owner",
               subject: "Relatorio Semanal de Contas",
               body: "<p>Segue em anexo o relatorio semanal de contas.</p><p>Este e-mail foi gerado automaticamente.</p>",
               includeAttachment: true,
            },
         },
      ],
      flowData: generateFlowData(
         "schedule.weekly",
         {
            time: "18:00",
            timezone: "America/Sao_Paulo",
            dayOfWeek: 5,
         } as TriggerConfig,
         [
            {
               type: "fetch_bills_report",
               label: "Buscar Relatorio de Contas",
               config: {
                  includePending: true,
                  includeOverdue: true,
                  daysAhead: 7,
                  billTypes: ["expense", "income"],
               },
            },
            {
               type: "format_data",
               label: "Formatar como CSV",
               config: {
                  outputFormat: "csv",
                  fileName: "relatorio_contas_{{date}}",
                  csvIncludeHeaders: true,
                  csvDelimiter: ";",
               },
            },
            {
               type: "send_email",
               label: "Enviar E-mail com Anexo",
               config: {
                  to: "owner",
                  subject: "Relatorio Semanal de Contas",
                  body: "<p>Segue em anexo o relatorio semanal de contas.</p><p>Este e-mail foi gerado automaticamente.</p>",
                  includeAttachment: true,
               },
            },
         ],
      ),
   },
];

// ============================================
// Seed Functions
// ============================================

export async function seedAutomationTemplates(db: DatabaseInstance) {
   console.log("Seeding automation templates...");

   for (const template of SYSTEM_TEMPLATES) {
      try {
         const result = await upsertSystemTemplate(db, template);
         if (result) {
            console.log(`  - Upserted template: ${result.name}`);
         }
      } catch (error) {
         console.error(
            `  - Failed to upsert template "${template.name}":`,
            error,
         );
         throw error;
      }
   }

   console.log(`Seeded ${SYSTEM_TEMPLATES.length} automation templates`);
}

// Export for direct execution
export { SYSTEM_TEMPLATES };
