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

const idSchema = z.object({ id: z.string().uuid() });
const createFromTemplateSchema = z.object({
   templateId: z.string(),
   name: z.string().min(2).max(120).optional(),
   schedule: z.object({
      cron: z.string().min(1),
      timezone: z.string().default("America/Sao_Paulo"),
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
      const nextRunAt = buildNextRunAt(
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
            ? buildNextRunAt(
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

export const activate = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const workflow = await loadWorkflowForTeam(context, input.id);
      const scheduleNode = getWorkflowScheduleNode(workflow.graph);
      const nextRunAt = buildNextRunAt(
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
   });

export const pause = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const workflow = await loadWorkflowForTeam(context, input.id);
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
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const workflow = await loadWorkflowForTeam(context, input.id);
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
   });

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
      if (Result.isError(enqueueResult)) throw enqueueResult.error;
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
