import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { and, desc, eq, inArray, max } from "drizzle-orm";
import dayjs from "dayjs";
import { z } from "zod";
import { protectedProcedure } from "@core/orpc/server";
import type { DatabaseInstance } from "@core/database/client";
import {
   workflowGraphSchema,
   workflowRuns,
   workflows,
   type Workflow,
} from "@core/database/schemas/workflows";
import {
   buildHumanLabel,
   buildNextRunAt,
   createWorkflowIdempotencyKey,
   findWorkflowScheduleNode,
   normalizeWorkflowTimezone,
   WORKFLOW_EXECUTE_QUEUE_NAME,
   WORKFLOW_EXECUTE_WORKFLOW_NAME,
} from "./runtime-constants";
import {
   createWorkflowGraphFromTemplate,
   getWorkflowTemplate,
   workflowTemplates,
} from "./templates";

const workflowsRouterErrors = defineErrorCatalog("workflows.router", {
   INTERNAL: {
      status: 500,
      message: "Falha interna em automações.",
      tags: ["workflows", "router"],
   },
   INVALID_GRAPH: {
      status: 400,
      message: "Fluxo da automação inválido.",
      tags: ["workflows", "router"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Automação não encontrada.",
      tags: ["workflows", "router"],
   },
   TEMPLATE_NOT_FOUND: {
      status: 404,
      message: "Modelo de automação não encontrado.",
      tags: ["workflows", "router"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "workflows.router": typeof workflowsRouterErrors;
   }
}

class WorkflowsRouterError extends TaggedError("WorkflowsRouterError")<{
   error:
      | ReturnType<typeof workflowsRouterErrors.INTERNAL>
      | ReturnType<typeof workflowsRouterErrors.INVALID_GRAPH>
      | ReturnType<typeof workflowsRouterErrors.NOT_FOUND>
      | ReturnType<typeof workflowsRouterErrors.TEMPLATE_NOT_FOUND>;
   message: string;
}>() {}

function isIntegerInRange(value: string, min: number, max: number) {
   if (!/^\d+$/.test(value)) return false;
   const numeric = Number(value);
   return Number.isInteger(numeric) && numeric >= min && numeric <= max;
}

function getWorkflowScheduleNodeOrThrow(graph: Workflow["graph"]) {
   const node = findWorkflowScheduleNode(graph);
   if (!node)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.INVALID_GRAPH(),
         message: "Workflow sem nó de agenda esperado.",
      });
   return node;
}

function isSupportedWorkflowCron(cron: string) {
   const [minute, hour, dayOfMonth, month, dayOfWeek, extra] = cron
      .trim()
      .split(/\s+/);
   if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek || extra)
      return false;
   if (!isIntegerInRange(minute, 0, 59)) return false;
   if (!isIntegerInRange(hour, 0, 23)) return false;
   if (month !== "*") return false;

   const isMonthly = dayOfWeek === "*" && isIntegerInRange(dayOfMonth, 1, 31);
   const isWeekly = dayOfMonth === "*" && isIntegerInRange(dayOfWeek, 0, 7);
   return isMonthly || isWeekly;
}

const workflowCronInputSchema = z
   .string()
   .trim()
   .refine(isSupportedWorkflowCron, "Agenda técnica da automação inválida.");
const workflowTimezoneInputSchema = z.literal("America/Sao_Paulo");
const idSchema = z.object({ id: z.string().uuid() });
const idsSchema = z.object({
   ids: z.array(z.string().uuid()).min(1).max(500),
});
const createFromTemplateSchema = z.object({
   templateId: z.string(),
   name: z.string().min(2).max(120).optional(),
   schedule: z
      .object({
         cron: workflowCronInputSchema,
         timezone: workflowTimezoneInputSchema.default("America/Sao_Paulo"),
      })
      .optional(),
});
const updateSchema = z.object({
   id: z.string().uuid(),
   name: z.string().min(2).max(120).optional(),
   graph: workflowGraphSchema,
});
const runsListSchema = z.object({
   workflowId: z.string().uuid(),
   limit: z.number().int().min(1).max(100).catch(20).default(20),
});

async function loadWorkflowForTeam(
   context: { db: DatabaseInstance; teamId: string },
   id: string,
) {
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.workflows.findFirst({
            where: (f, { and, eq }) =>
               and(eq(f.id, id), eq(f.teamId, context.teamId)),
         }),
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao carregar automação.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Automação não encontrada.",
      });
   return result.value;
}

async function loadWorkflowsForTeam(
   context: { db: DatabaseInstance; teamId: string },
   ids: string[],
) {
   const uniqueIds = [...new Set(ids)];
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.workflows.findMany({
            where: (f, { and, eq, inArray: inArr }) =>
               and(eq(f.teamId, context.teamId), inArr(f.id, uniqueIds)),
         }),
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao carregar automações.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (result.value.length !== uniqueIds.length)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Uma ou mais automações não foram encontradas.",
      });
   return result.value;
}

async function loadWorkflowRunForTeam(
   context: { db: DatabaseInstance; teamId: string },
   id: string,
) {
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.workflowRuns.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao carregar execução.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Execução da automação não encontrada.",
      });
   const workflow = await loadWorkflowForTeam(context, result.value.workflowId);
   return { workflow, run: result.value };
}

function buildNextRunAtOrThrow(
   cron: string,
   timezoneValue: string,
   currentDate: Date,
) {
   const result = Result.try({
      try: () => buildNextRunAt(cron, timezoneValue, currentDate),
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INVALID_GRAPH(),
            message: "Agenda da automação inválida.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   return result.value;
}

const BLANK_WORKFLOW_NAME_TEMPLATES = ["Automação em branco", "Workflow vazio"];

function isBlankWorkflowStub(workflow: Pick<Workflow, "graph" | "templateId">) {
   const blankTemplate = getWorkflowTemplate("blank");
   if (!blankTemplate || workflow.templateId !== blankTemplate.id) {
      return false;
   }

   const scheduleNode = workflow.graph.nodes.find(
      (node) => node.type === "scheduleTrigger",
   );
   const reportNode = workflow.graph.nodes.find(
      (node) => node.type === "createReport",
   );
   if (!scheduleNode || !reportNode) return false;

   const blankScheduleNode = blankTemplate.defaultGraph.nodes[0];
   const blankReportNode = blankTemplate.defaultGraph.nodes[1];
   return (
      scheduleNode.data.cron === blankScheduleNode.data.cron &&
      scheduleNode.data.timezone === blankScheduleNode.data.timezone &&
      scheduleNode.data.humanLabel === blankScheduleNode.data.humanLabel &&
      reportNode.data.reportType === blankReportNode.data.reportType &&
      reportNode.data.period.kind === blankReportNode.data.period.kind &&
      BLANK_WORKFLOW_NAME_TEMPLATES.includes(reportNode.data.nameTemplate)
   );
}

function assertWorkflowCanActivate(
   workflow: Pick<Workflow, "graph" | "templateId">,
) {
   if (!isBlankWorkflowStub(workflow)) return;

   throw new WorkflowsRouterError({
      error: workflowsRouterErrors.INVALID_GRAPH(),
      message: "Configure esta automação antes de ativar.",
   });
}

function assertWorkflowCanRun(
   workflow: Pick<Workflow, "graph" | "templateId">,
) {
   if (!isBlankWorkflowStub(workflow)) return;

   throw new WorkflowsRouterError({
      error: workflowsRouterErrors.INVALID_GRAPH(),
      message: "Configure esta automação antes de executar.",
   });
}

export const templates = {
   list: protectedProcedure.handler(async () => workflowTemplates),
};

export const list = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.workflows.findMany({
            where: (f, { eq }) => eq(f.teamId, context.teamId),
            orderBy: (f, { desc }) => [desc(f.createdAt)],
         }),
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao listar automações.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (result.value.length === 0) return [];

   const workflowIds = result.value.map((workflow) => workflow.id);
   const latestRunTimesResult = await Result.tryPromise({
      try: () => {
         const latestRunTimes = context.db
            .select({
               workflowId: workflowRuns.workflowId,
               scheduledFor: max(workflowRuns.scheduledFor).as("scheduledFor"),
            })
            .from(workflowRuns)
            .where(inArray(workflowRuns.workflowId, workflowIds))
            .groupBy(workflowRuns.workflowId)
            .as("latestRunTimes");

         return context.db
            .select({
               id: workflowRuns.id,
               workflowId: workflowRuns.workflowId,
               status: workflowRuns.status,
               scheduledFor: workflowRuns.scheduledFor,
               startedAt: workflowRuns.startedAt,
               endedAt: workflowRuns.endedAt,
               reportId: workflowRuns.reportId,
               idempotencyKey: workflowRuns.idempotencyKey,
               error: workflowRuns.error,
               triggeredBy: workflowRuns.triggeredBy,
            })
            .from(workflowRuns)
            .innerJoin(
               latestRunTimes,
               and(
                  eq(workflowRuns.workflowId, latestRunTimes.workflowId),
                  eq(workflowRuns.scheduledFor, latestRunTimes.scheduledFor),
               ),
            );
      },
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao carregar a última execução das automações.",
         }),
   });
   if (Result.isError(latestRunTimesResult)) throw latestRunTimesResult.error;
   const latestRunsByWorkflowId = new Map(
      latestRunTimesResult.value.map((run) => [run.workflowId, run]),
   );

   return result.value.map((workflow) => ({
      ...workflow,
      latestRun: latestRunsByWorkflowId.get(workflow.id) ?? null,
   }));
});

export const get = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) =>
      loadWorkflowForTeam(context, input.id),
   );

export const createFromTemplate = protectedProcedure
   .input(createFromTemplateSchema)
   .handler(async ({ context, input }) => {
      const template = getWorkflowTemplate(input.templateId);
      if (!template)
         throw new WorkflowsRouterError({
            error: workflowsRouterErrors.TEMPLATE_NOT_FOUND(),
            message: "Modelo de automação não encontrado.",
         });
      const cron = input.schedule?.cron ?? template.defaultCron;
      const timezoneValue = normalizeWorkflowTimezone(
         input.schedule?.timezone ?? "America/Sao_Paulo",
      );
      const graph = createWorkflowGraphFromTemplate(template, {
         cron,
         humanLabel: buildHumanLabel(cron),
      });
      const isBlankWorkflow = template.id === "blank";
      const nextRunAt = isBlankWorkflow
         ? null
         : buildNextRunAtOrThrow(cron, timezoneValue, dayjs().toDate());
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(workflows)
                  .values({
                     teamId: context.teamId,
                     templateId: template.id,
                     name: isBlankWorkflow
                        ? "Automação em branco"
                        : (input.name ?? template.name),
                     status: isBlankWorkflow ? "paused" : "active",
                     graph,
                     nextRunAt,
                     createdBy: context.userId,
                  })
                  .returning();
               return row;
            }),
         catch: () =>
            new WorkflowsRouterError({
               error: workflowsRouterErrors.INTERNAL(),
               message: "Falha ao criar automação.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value)
         throw new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao criar automação.",
         });
      return result.value;
   });

export const update = protectedProcedure
   .input(updateSchema)
   .handler(async ({ context, input }) => {
      const workflow = await loadWorkflowForTeam(context, input.id);
      const scheduleNode = getWorkflowScheduleNodeOrThrow(input.graph);
      const timezoneValue = normalizeWorkflowTimezone(
         scheduleNode.data.timezone,
      );
      const nextRunAt =
         workflow.status === "active"
            ? buildNextRunAtOrThrow(
                 scheduleNode.data.cron,
                 timezoneValue,
                 dayjs().toDate(),
              )
            : null;
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(workflows)
                  .set({
                     name: input.name ?? workflow.name,
                     graph: input.graph,
                     nextRunAt,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(eq(workflows.id, workflow.id))
                  .returning();
               return row;
            }),
         catch: () =>
            new WorkflowsRouterError({
               error: workflowsRouterErrors.INTERNAL(),
               message: "Falha ao atualizar automação.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value)
         throw new WorkflowsRouterError({
            error: workflowsRouterErrors.NOT_FOUND(),
            message: "Automação não encontrada.",
         });
      return result.value;
   });

async function activateWorkflowForTeam(
   context: { db: DatabaseInstance; teamId: string },
   id: string,
) {
   const workflow = await loadWorkflowForTeam(context, id);
   assertWorkflowCanActivate(workflow);
   const scheduleNode = getWorkflowScheduleNodeOrThrow(workflow.graph);
   const nextRunAt = buildNextRunAtOrThrow(
      scheduleNode.data.cron,
      normalizeWorkflowTimezone(scheduleNode.data.timezone),
      dayjs().toDate(),
   );
   const result = await Result.tryPromise({
      try: () =>
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(workflows)
               .set({
                  status: "active",
                  nextRunAt,
                  updatedAt: dayjs().toDate(),
               })
               .where(eq(workflows.id, workflow.id))
               .returning();
            return row;
         }),
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao ativar automação.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Automação não encontrada.",
      });
   return result.value;
}

async function pauseWorkflowForTeam(
   context: { db: DatabaseInstance; teamId: string },
   id: string,
) {
   const workflow = await loadWorkflowForTeam(context, id);
   const result = await Result.tryPromise({
      try: () =>
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(workflows)
               .set({
                  status: "paused",
                  nextRunAt: null,
                  updatedAt: dayjs().toDate(),
               })
               .where(eq(workflows.id, workflow.id))
               .returning();
            return row;
         }),
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao pausar automação.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Automação não encontrada.",
      });
   return result.value;
}

async function removeWorkflowForTeam(
   context: { db: DatabaseInstance; teamId: string },
   id: string,
) {
   const workflow = await loadWorkflowForTeam(context, id);
   const result = await Result.tryPromise({
      try: () =>
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .delete(workflows)
               .where(eq(workflows.id, workflow.id))
               .returning();
            return row;
         }),
      catch: () =>
         new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao excluir automação.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Automação não encontrada.",
      });
   return { success: true };
}

export const activate = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) =>
      activateWorkflowForTeam(context, input.id),
   );

export const pause = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) =>
      pauseWorkflowForTeam(context, input.id),
   );

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) =>
      removeWorkflowForTeam(context, input.id),
   );

export const bulkActivate = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const owned = await loadWorkflowsForTeam(context, input.ids);
      owned.forEach(assertWorkflowCanActivate);
      const workflowIds = owned.map((workflow) => workflow.id);
      const now = dayjs().toDate();
      const nextRuns = owned.map((workflow) => {
         const scheduleNode = getWorkflowScheduleNodeOrThrow(workflow.graph);
         return {
            id: workflow.id,
            nextRunAt: buildNextRunAtOrThrow(
               scheduleNode.data.cron,
               normalizeWorkflowTimezone(scheduleNode.data.timezone),
               now,
            ),
         };
      });
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const updates = await Promise.allSettled(
                  nextRuns.map((workflow) =>
                     tx
                        .update(workflows)
                        .set({
                           status: "active",
                           nextRunAt: workflow.nextRunAt,
                           updatedAt: now,
                        })
                        .where(
                           and(
                              eq(workflows.teamId, context.teamId),
                              eq(workflows.id, workflow.id),
                           ),
                        ),
                  ),
               );
               const failed = updates.find(
                  (update) => update.status === "rejected",
               );
               if (failed) throw failed.reason;
            }),
         catch: () =>
            new WorkflowsRouterError({
               error: workflowsRouterErrors.INTERNAL(),
               message: "Falha ao ativar automações.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { updated: workflowIds.length };
   });

export const bulkPause = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const owned = await loadWorkflowsForTeam(context, input.ids);
      const workflowIds = owned.map((workflow) => workflow.id);
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(workflows)
                  .set({
                     status: "paused",
                     nextRunAt: null,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(
                     and(
                        eq(workflows.teamId, context.teamId),
                        inArray(workflows.id, workflowIds),
                     ),
                  ),
            ),
         catch: () =>
            new WorkflowsRouterError({
               error: workflowsRouterErrors.INTERNAL(),
               message: "Falha ao pausar automações.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { updated: workflowIds.length };
   });

export const bulkRemove = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const owned = await loadWorkflowsForTeam(context, input.ids);
      const workflowIds = owned.map((workflow) => workflow.id);
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .delete(workflows)
                  .where(
                     and(
                        eq(workflows.teamId, context.teamId),
                        inArray(workflows.id, workflowIds),
                     ),
                  ),
            ),
         catch: () =>
            new WorkflowsRouterError({
               error: workflowsRouterErrors.INTERNAL(),
               message: "Falha ao excluir automações.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { deleted: workflowIds.length };
   });

export const runNow = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const workflow = await loadWorkflowForTeam(context, input.id);
      assertWorkflowCanRun(workflow);
      const scheduledFor = dayjs().toDate();
      const idempotencyKey = createWorkflowIdempotencyKey(
         workflow.id,
         scheduledFor,
      );
      const runResult = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(workflowRuns)
                  .values({
                     workflowId: workflow.id,
                     status: "pending",
                     scheduledFor,
                     idempotencyKey,
                     triggeredBy: "manual",
                  })
                  .returning();
               return row;
            }),
         catch: () =>
            new WorkflowsRouterError({
               error: workflowsRouterErrors.INTERNAL(),
               message: "Falha ao executar automação agora.",
            }),
      });
      if (Result.isError(runResult)) throw runResult.error;
      const run = runResult.value;
      if (!run)
         throw new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao executar automação agora.",
         });
      const enqueueResult = await Result.tryPromise({
         try: () =>
            context.workflowClient.enqueue(
               {
                  workflowName: WORKFLOW_EXECUTE_WORKFLOW_NAME,
                  queueName: WORKFLOW_EXECUTE_QUEUE_NAME,
                  workflowID: run.id,
               },
               {
                  workflowId: workflow.id,
                  runId: run.id,
                  scheduledFor,
                  triggeredBy: "manual",
               },
            ),
         catch: () =>
            new WorkflowsRouterError({
               error: workflowsRouterErrors.INTERNAL(),
               message: "Falha ao enfileirar execução da automação.",
            }),
      });
      if (Result.isError(enqueueResult)) {
         const markFailedResult = await Result.tryPromise({
            try: () =>
               context.db.transaction(async (tx) => {
                  const [row] = await tx
                     .update(workflowRuns)
                     .set({
                        status: "failed",
                        endedAt: dayjs().toDate(),
                        error: enqueueResult.error.message,
                     })
                     .where(eq(workflowRuns.id, run.id))
                     .returning();
                  return row;
               }),
            catch: () =>
               new WorkflowsRouterError({
                  error: workflowsRouterErrors.INTERNAL(),
                  message: "Falha ao registrar falha da execução da automação.",
               }),
         });
         if (Result.isError(markFailedResult)) throw markFailedResult.error;
         throw enqueueResult.error;
      }
      return run;
   });

export const runs = {
   list: protectedProcedure
      .input(runsListSchema)
      .handler(async ({ context, input }) => {
         const workflow = await loadWorkflowForTeam(context, input.workflowId);
         return context.db
            .select()
            .from(workflowRuns)
            .where(eq(workflowRuns.workflowId, workflow.id))
            .orderBy(desc(workflowRuns.scheduledFor))
            .limit(input.limit);
      }),
   get: protectedProcedure
      .input(idSchema)
      .handler(async ({ context, input }) =>
         loadWorkflowRunForTeam(context, input.id).then((row) => row.run),
      ),
};

export default {
   activate,
   bulkActivate,
   bulkPause,
   bulkRemove,
   createFromTemplate,
   get,
   list,
   pause,
   remove,
   runNow,
   runs,
   templates,
   update,
};
