import "dayjs/locale/pt-br";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { and, desc, eq } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import {
   reports,
   type ReportConfig,
   type ReportType,
} from "@core/database/schemas/reports";
import {
   workflowRuns,
   workflows,
   type WorkflowGraph,
   type WorkflowRunTriggeredBy,
} from "@core/database/schemas/workflows";
import { workflowsDataSource } from "./data-source";
import type { WorkflowTemplatePeriod } from "./templates";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("pt-br");

export const WORKFLOW_TIMEZONE = "America/Sao_Paulo";
export const WORKFLOW_EXECUTE_QUEUE_NAME = "workflow:workflows/execute";
export const WORKFLOW_SCHEDULER_QUEUE_NAME = "workflow:workflows/scheduler";
export const WORKFLOW_EXECUTE_WORKFLOW_NAME = "executeWorkflowWorkflowFn";
export const WORKFLOW_SCHEDULER_WORKFLOW_NAME = "pollDueWorkflowsWorkflowFn";

export const workflowsRuntimeErrors = defineErrorCatalog("workflows.runtime", {
   EXECUTE_FAILED: {
      status: 500,
      message: "Falha ao executar workflow.",
      tags: ["workflows", "runtime"],
   },
   LOAD_WORKFLOW_FAILED: {
      status: 500,
      message: "Falha ao carregar workflow.",
      tags: ["workflows", "runtime"],
   },
   MARK_RUN_FAILED: {
      status: 500,
      message: "Falha ao atualizar execução do workflow.",
      tags: ["workflows", "runtime"],
   },
   WORKFLOW_RUN_NOT_FOUND: {
      status: 404,
      message: "Execução do workflow não encontrada.",
      tags: ["workflows", "runtime"],
   },
   WORKFLOW_RUN_LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar execução do workflow.",
      tags: ["workflows", "runtime"],
   },
   NEXT_RUN_FAILED: {
      status: 500,
      message: "Falha ao calcular próxima execução.",
      tags: ["workflows", "runtime"],
   },
   REPORT_CREATE_FAILED: {
      status: 500,
      message: "Falha ao criar relatório do workflow.",
      tags: ["workflows", "runtime"],
   },
   WORKFLOW_NOT_FOUND: {
      status: 404,
      message: "Workflow não encontrado.",
      tags: ["workflows", "runtime"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "workflows.runtime": typeof workflowsRuntimeErrors;
   }
}

export type WorkflowsRuntimeCatalogError =
   | ReturnType<typeof workflowsRuntimeErrors.EXECUTE_FAILED>
   | ReturnType<typeof workflowsRuntimeErrors.LOAD_WORKFLOW_FAILED>
   | ReturnType<typeof workflowsRuntimeErrors.MARK_RUN_FAILED>
   | ReturnType<typeof workflowsRuntimeErrors.WORKFLOW_RUN_NOT_FOUND>
   | ReturnType<typeof workflowsRuntimeErrors.WORKFLOW_RUN_LOAD_FAILED>
   | ReturnType<typeof workflowsRuntimeErrors.NEXT_RUN_FAILED>
   | ReturnType<typeof workflowsRuntimeErrors.REPORT_CREATE_FAILED>
   | ReturnType<typeof workflowsRuntimeErrors.WORKFLOW_NOT_FOUND>;
export class WorkflowsRuntimeError extends TaggedError(
   "WorkflowsRuntimeError",
)<{
   error: WorkflowsRuntimeCatalogError;
   message: string;
}>() {}

function getErrorField(error: unknown, field: string) {
   if (!(error && (typeof error === "object" || typeof error === "function")))
      return undefined;
   const value = Reflect.get(error, field);
   if (typeof value !== "string") return undefined;
   return value;
}

function isWorkflowRunNotFoundError(error: unknown) {
   return (
      getErrorField(error, "name") === "NotFoundError" ||
      getErrorField(error, "code") === "NOT_FOUND"
   );
}

export type WorkflowPeriod = {
   from: Date;
   to: Date;
};

export function normalizeWorkflowTimezone(
   timezoneValue: string | null | undefined,
) {
   return timezoneValue === WORKFLOW_TIMEZONE
      ? timezoneValue
      : WORKFLOW_TIMEZONE;
}

export function buildHumanLabel(cron: string) {
   const [minute, hour, dayOfMonth, , dayOfWeek] = cron.split(" ");
   const hourLabel = hour?.padStart(2, "0") ?? "00";
   const minuteLabel = minute?.padStart(2, "0") ?? "00";
   if (dayOfMonth && dayOfMonth !== "*" && dayOfWeek === "*") {
      return `Todo dia ${dayOfMonth} às ${hourLabel}:${minuteLabel}`;
   }
   if (dayOfWeek && dayOfWeek !== "*" && dayOfMonth === "*") {
      const weekdayNames = [
         "domingo",
         "segunda",
         "terça",
         "quarta",
         "quinta",
         "sexta",
         "sábado",
      ];
      const normalizedWeekday = ((Number(dayOfWeek) % 7) + 7) % 7;
      const weekday = weekdayNames[normalizedWeekday] ?? "segunda";
      return `Toda ${weekday} às ${hourLabel}:${minuteLabel}`;
   }
   return `Agendado às ${hourLabel}:${minuteLabel}`;
}

export function buildNextRunAt(
   cron: string,
   timezoneValue: string,
   currentDate: Date,
) {
   const interval = CronExpressionParser.parse(cron, {
      currentDate,
      tz: timezoneValue,
   });
   return interval.next().toDate();
}

export function computeWorkflowPeriod(
   period: WorkflowTemplatePeriod,
   scheduledFor: Date,
   timezoneValue: string,
): WorkflowPeriod {
   const local = dayjs(scheduledFor).tz(timezoneValue);
   if (period === "previous-month") {
      const currentMonthStart = local.startOf("month");
      return {
         from: currentMonthStart.subtract(1, "month").toDate(),
         to: currentMonthStart.toDate(),
      };
   }
   if (period === "current-month") {
      const monthStart = local.startOf("month");
      return {
         from: monthStart.toDate(),
         to: monthStart.add(1, "month").toDate(),
      };
   }
   const weekday = local.day();
   const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
   const weekStart = local.startOf("day").add(mondayOffset, "day");
   if (period === "previous-week") {
      return {
         from: weekStart.subtract(7, "day").toDate(),
         to: weekStart.toDate(),
      };
   }
   return {
      from: weekStart.toDate(),
      to: weekStart.add(7, "day").toDate(),
   };
}

export function renderWorkflowName(
   template: string,
   period: WorkflowPeriod,
   timezoneValue: string,
) {
   const start = dayjs(period.from).tz(timezoneValue);
   const end = dayjs(period.to).tz(timezoneValue);
   return template
      .replaceAll("{month}", start.format("MMMM"))
      .replaceAll("{year}", start.format("YYYY"))
      .replaceAll("{week}", start.format("DD/MM"))
      .replaceAll(
         "{range}",
         `${start.format("DD/MM")} — ${end.format("DD/MM")}`,
      );
}

export function buildWorkflowReportConfig(input: {
   reportType: ReportType;
   period: WorkflowPeriod;
   timezone: string;
}): ReportConfig {
   const start = dayjs(input.period.from).tz(input.timezone);
   const end = dayjs(input.period.to).tz(input.timezone).subtract(1, "day");
   const base: ReportConfig = {
      dateFrom: start.format("YYYY-MM-DD"),
      dateTo: end.format("YYYY-MM-DD"),
      status: "paid",
      bankAccountId: undefined,
      categoryId: undefined,
      tagId: undefined,
      dreOnly: true,
      agingType: "income",
      agingStatus: "open",
      categoryDepth: "group",
      minAmount: 0,
   };
   if (input.reportType === "aging") {
      return { ...base, agingType: "expense" };
   }
   return base;
}

export function getWorkflowScheduleNode(graph: WorkflowGraph) {
   const node = graph.nodes.find(
      (node): node is WorkflowGraph["nodes"][0] =>
         node.type === "scheduleTrigger",
   );
   if (!node) {
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.WORKFLOW_NOT_FOUND(),
         message: "Workflow sem nó de agenda esperado.",
      });
   }
   return node;
}

export function getWorkflowActionNode(graph: WorkflowGraph) {
   const node = graph.nodes.find(
      (node): node is WorkflowGraph["nodes"][1] => node.type === "createReport",
   );
   if (!node) {
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.WORKFLOW_NOT_FOUND(),
         message: "Workflow sem nó de relatório esperado.",
      });
   }
   return node;
}

export async function loadWorkflowById(workflowId: string) {
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               const [row] = await tx
                  .select()
                  .from(workflows)
                  .where(eq(workflows.id, workflowId))
                  .limit(1);
               return row ?? null;
            },
            { name: "load-workflow-by-id" },
         ),
      catch: () =>
         new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.LOAD_WORKFLOW_FAILED(),
            message: "Falha ao carregar workflow.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.WORKFLOW_NOT_FOUND(),
         message: "Workflow não encontrado.",
      });
   return result.value;
}

export async function loadWorkflowRunForWorkflow(input: {
   workflowId: string;
   runId: string;
}) {
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               const [row] = await tx
                  .select()
                  .from(workflowRuns)
                  .where(
                     and(
                        eq(workflowRuns.id, input.runId),
                        eq(workflowRuns.workflowId, input.workflowId),
                     ),
                  )
                  .limit(1);
               return row ?? null;
            },
            { name: "load-workflow-run-for-workflow" },
         ),
      catch: (error) => {
         if (isWorkflowRunNotFoundError(error)) {
            return new WorkflowsRuntimeError({
               error: workflowsRuntimeErrors.WORKFLOW_RUN_NOT_FOUND(),
               message:
                  "Execução do workflow não encontrada para este workflow.",
            });
         }

         const message =
            getErrorField(error, "message") ??
            workflowsRuntimeErrors.WORKFLOW_RUN_LOAD_FAILED().message;
         return new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.WORKFLOW_RUN_LOAD_FAILED(),
            message,
         });
      },
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.WORKFLOW_RUN_NOT_FOUND(),
         message: "Execução do workflow não encontrada para este workflow.",
      });
   return result.value;
}

export async function loadWorkflowRunRows(workflowId: string, limit = 20) {
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               return tx
                  .select()
                  .from(workflowRuns)
                  .where(eq(workflowRuns.workflowId, workflowId))
                  .orderBy(desc(workflowRuns.scheduledFor))
                  .limit(limit);
            },
            { name: "load-workflow-run-rows" },
         ),
      catch: () =>
         new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.WORKFLOW_RUN_LOAD_FAILED(),
            message: "Falha ao listar execuções do workflow.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   return result.value;
}

export async function createWorkflowRun(input: {
   workflowId: string;
   scheduledFor: Date;
   triggeredBy: WorkflowRunTriggeredBy;
}) {
   const workflow = await loadWorkflowById(input.workflowId);
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               const [row] = await tx
                  .insert(workflowRuns)
                  .values({
                     workflowId: workflow.id,
                     status: "pending",
                     scheduledFor: input.scheduledFor,
                     idempotencyKey: `${workflow.id}-${input.scheduledFor.toISOString()}`,
                     triggeredBy: input.triggeredBy,
                  })
                  .onConflictDoNothing()
                  .returning();
               return row;
            },
            { name: "create-workflow-run" },
         ),
      catch: () =>
         new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.MARK_RUN_FAILED(),
            message: "Falha ao criar execução do workflow.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value) return null;
   return result.value;
}

export async function markWorkflowRunRunning(runId: string) {
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               const [row] = await tx
                  .update(workflowRuns)
                  .set({ status: "running", startedAt: dayjs().toDate() })
                  .where(eq(workflowRuns.id, runId))
                  .returning();
               return row;
            },
            { name: "mark-workflow-run-running" },
         ),
      catch: () =>
         new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.MARK_RUN_FAILED(),
            message: "Falha ao marcar execução como em andamento.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.WORKFLOW_RUN_NOT_FOUND(),
         message: "Execução do workflow não encontrada.",
      });
   return result.value;
}

export async function markWorkflowRunSucceeded(input: {
   runId: string;
   reportId: string;
}) {
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               const [row] = await tx
                  .update(workflowRuns)
                  .set({
                     status: "succeeded",
                     reportId: input.reportId,
                     endedAt: dayjs().toDate(),
                     error: null,
                  })
                  .where(eq(workflowRuns.id, input.runId))
                  .returning();
               return row;
            },
            { name: "mark-workflow-run-succeeded" },
         ),
      catch: () =>
         new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.MARK_RUN_FAILED(),
            message: "Falha ao marcar execução como concluída.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.WORKFLOW_RUN_NOT_FOUND(),
         message: "Execução do workflow não encontrada.",
      });
   return result.value;
}

export async function markWorkflowRunFailed(input: {
   runId: string;
   errorMessage: string;
}) {
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               const [row] = await tx
                  .update(workflowRuns)
                  .set({
                     status: "failed",
                     endedAt: dayjs().toDate(),
                     error: input.errorMessage,
                  })
                  .where(eq(workflowRuns.id, input.runId))
                  .returning();
               return row;
            },
            { name: "mark-workflow-run-failed" },
         ),
      catch: () =>
         new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.MARK_RUN_FAILED(),
            message: "Falha ao marcar execução como falha.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.WORKFLOW_RUN_NOT_FOUND(),
         message: "Execução do workflow não encontrada.",
      });
   return result.value;
}

export async function updateWorkflowNextRunAt(input: {
   workflowId: string;
   cron: string;
   timezone: string;
   scheduledFor: Date;
}) {
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               const nextRunAt = buildNextRunAt(
                  input.cron,
                  input.timezone,
                  input.scheduledFor,
               );
               const [row] = await tx
                  .update(workflows)
                  .set({ nextRunAt, updatedAt: dayjs().toDate() })
                  .where(eq(workflows.id, input.workflowId))
                  .returning();
               return row;
            },
            { name: "update-workflow-next-run-at" },
         ),
      catch: () =>
         new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.NEXT_RUN_FAILED(),
            message: "Falha ao atualizar próxima execução.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.NEXT_RUN_FAILED(),
         message: "Workflow não encontrado para atualizar próxima execução.",
      });
   return result.value;
}

export function createWorkflowIdempotencyKey(
   workflowId: string,
   scheduledFor: Date,
) {
   return `${workflowId}-${scheduledFor.toISOString()}`;
}

export async function createWorkflowReport(input: {
   teamId: string;
   type: ReportType;
   name: string;
   config: ReportConfig;
}) {
   const result = await Result.tryPromise({
      try: () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               const [row] = await tx
                  .insert(reports)
                  .values({
                     teamId: input.teamId,
                     type: input.type,
                     source: "workflow",
                     name: input.name,
                     config: input.config,
                  })
                  .returning();
               return row;
            },
            { name: "create-workflow-report" },
         ),
      catch: () =>
         new WorkflowsRuntimeError({
            error: workflowsRuntimeErrors.REPORT_CREATE_FAILED(),
            message: "Falha ao criar relatório do workflow.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   if (!result.value)
      throw new WorkflowsRuntimeError({
         error: workflowsRuntimeErrors.REPORT_CREATE_FAILED(),
         message: "Falha ao criar relatório do workflow.",
      });
   return result.value;
}
