import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { desc, eq } from "drizzle-orm";
import dayjs from "dayjs";
import { z } from "zod";
import { protectedProcedure } from "@core/orpc/server";
import type { DatabaseInstance } from "@core/database/client";
import { workflowGraphSchema, workflowRuns, workflows } from "./schema";
import {
   buildHumanLabel,
   buildNextRunAt,
   createWorkflowIdempotencyKey,
   getWorkflowScheduleNode,
   normalizeWorkflowTimezone,
   WORKFLOW_EXECUTE_QUEUE_NAME,
   WORKFLOW_EXECUTE_WORKFLOW_NAME,
} from "./runtime";
import {
   createWorkflowGraphFromTemplate,
   getWorkflowTemplate,
   workflowTemplates,
} from "./templates";

const workflowsRouterErrors = defineErrorCatalog("workflows.router", {
   INTERNAL: {
      status: 500,
      message: "Falha interna em workflows.",
      tags: ["workflows", "router"],
   },
   INVALID_GRAPH: {
      status: 400,
      message: "Graph de workflow inválido.",
      tags: ["workflows", "router"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Workflow não encontrado.",
      tags: ["workflows", "router"],
   },
   TEMPLATE_NOT_FOUND: {
      status: 404,
      message: "Template de workflow não encontrado.",
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
   const isWeekly = dayOfMonth === "*" && isIntegerInRange(dayOfWeek, 0, 6);
   return isMonthly || isWeekly;
}

const workflowCronInputSchema = z
   .string()
   .trim()
   .refine(isSupportedWorkflowCron, "Cron de workflow inválido.");
const workflowTimezoneInputSchema = z.literal("America/Sao_Paulo");
const idSchema = z.object({ id: z.string().uuid() });
const createFromTemplateSchema = z.object({
   templateId: z.string(),
   name: z.string().min(2).max(120).optional(),
   schedule: z.object({
      cron: workflowCronInputSchema,
      timezone: workflowTimezoneInputSchema.default("America/Sao_Paulo"),
   }),
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
            message: "Falha ao carregar workflow.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Workflow não encontrado.",
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
         message: "Execução do workflow não encontrada.",
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
            message: "Agenda do workflow inválida.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   return result.value;
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
            message: "Falha ao listar workflows.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   const rows = await Promise.all(
      result.value.map(async (workflow) => ({
         ...workflow,
         latestRun: await context.db
            .select()
            .from(workflowRuns)
            .where(eq(workflowRuns.workflowId, workflow.id))
            .orderBy(desc(workflowRuns.scheduledFor))
            .limit(1)
            .then((runs) => runs[0] ?? null),
      })),
   );
   return rows;
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
            message: "Template de workflow não encontrado.",
         });
      const timezoneValue = normalizeWorkflowTimezone(input.schedule.timezone);
      const graph = createWorkflowGraphFromTemplate(template, {
         cron: input.schedule.cron,
         humanLabel: buildHumanLabel(input.schedule.cron),
      });
      const nextRunAt = buildNextRunAtOrThrow(
         input.schedule.cron,
         timezoneValue,
         dayjs().toDate(),
      );
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(workflows)
                  .values({
                     teamId: context.teamId,
                     templateId: template.id,
                     name: input.name ?? template.name,
                     status: "active",
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
               message: "Falha ao criar workflow.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value)
         throw new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao criar workflow.",
         });
      return result.value;
   });

export const update = protectedProcedure
   .input(updateSchema)
   .handler(async ({ context, input }) => {
      const workflow = await loadWorkflowForTeam(context, input.id);
      const scheduleNode = getWorkflowScheduleNode(input.graph);
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
               message: "Falha ao atualizar workflow.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value)
         throw new WorkflowsRouterError({
            error: workflowsRouterErrors.NOT_FOUND(),
            message: "Workflow não encontrado.",
         });
      return result.value;
   });

async function activateWorkflowForTeam(
   context: { db: DatabaseInstance; teamId: string },
   id: string,
) {
   const workflow = await loadWorkflowForTeam(context, id);
   const scheduleNode = getWorkflowScheduleNode(workflow.graph);
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
            message: "Falha ao ativar workflow.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Workflow não encontrado.",
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
            message: "Falha ao pausar workflow.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Workflow não encontrado.",
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
            message: "Falha ao excluir workflow.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRouterError({
         error: workflowsRouterErrors.NOT_FOUND(),
         message: "Workflow não encontrado.",
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

export const runNow = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const workflow = await loadWorkflowForTeam(context, input.id);
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
               message: "Falha ao iniciar workflow agora.",
            }),
      });
      if (Result.isError(runResult)) throw runResult.error;
      const run = runResult.value;
      if (!run)
         throw new WorkflowsRouterError({
            error: workflowsRouterErrors.INTERNAL(),
            message: "Falha ao iniciar workflow agora.",
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
               message: "Falha ao enfileirar execução do workflow.",
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
                  message: "Falha ao registrar falha da execução do workflow.",
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
