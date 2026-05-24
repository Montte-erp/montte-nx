import { Result } from "better-result";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { and, asc, eq, lte } from "drizzle-orm";
import dayjs from "dayjs";
import { workflowsDataSource } from "./data-source";
import { workflows } from "@core/database/schemas/workflows";
import {
   createWorkflowRun,
   getWorkflowScheduleNode,
   markWorkflowRunFailed,
   normalizeWorkflowTimezone,
   updateWorkflowNextRunAt,
} from "./runtime";
import {
   WORKFLOW_EXECUTE_QUEUE_NAME,
   WORKFLOW_SCHEDULER_QUEUE_NAME,
   WORKFLOW_SCHEDULER_WORKFLOW_NAME,
} from "./runtime-constants";
import { executeWorkflowWorkflow } from "./workflows/execute-workflow.workflow";

const BATCH_SIZE = 20;

export async function pollDueWorkflowsOnce() {
   const now = dayjs().toDate();
   const due = await DBOS.runStep(
      () =>
         workflowsDataSource.runTransaction(
            async () => {
               const tx = workflowsDataSource.client;
               return tx
                  .select()
                  .from(workflows)
                  .where(
                     and(
                        eq(workflows.status, "active"),
                        lte(workflows.nextRunAt, now),
                     ),
                  )
                  .orderBy(asc(workflows.nextRunAt))
                  .limit(BATCH_SIZE)
                  .for("update", { skipLocked: true });
            },
            { name: "load-due-workflows" },
         ),
      { name: "load-due-workflows" },
   );

   if (due.length === 0) return;
   for (const workflow of due) {
      const scheduledFor = workflow.nextRunAt;
      if (!scheduledFor) continue;

      const runResult = await Result.tryPromise({
         try: () =>
            DBOS.runStep(
               () =>
                  createWorkflowRun({
                     workflowId: workflow.id,
                     scheduledFor,
                     triggeredBy: "schedule",
                  }),
               { name: `create-workflow-run-${workflow.id}` },
            ),
         catch: () => "Falha ao criar execução agendada do workflow.",
      });
      if (Result.isError(runResult)) {
         DBOS.logger.error(
            `[workflows-scheduler] Falha ao criar execução workflow=${workflow.id} scheduledFor=${scheduledFor.toISOString()} error=${runResult.error}`,
         );
         continue;
      }
      const run = runResult.value;
      if (!run) continue;

      const startResult = await Result.tryPromise({
         try: () =>
            DBOS.startWorkflow(executeWorkflowWorkflow, {
               workflowID: run.id,
               queueName: WORKFLOW_EXECUTE_QUEUE_NAME,
            })({
               workflowId: workflow.id,
               runId: run.id,
               scheduledFor,
               triggeredBy: "schedule",
            }),
         catch: () => "Falha ao iniciar workflow executável.",
      });
      if (Result.isError(startResult)) {
         DBOS.logger.error(
            `[workflows-scheduler] Falha ao iniciar execução workflow=${workflow.id} run=${run.id} scheduledFor=${scheduledFor.toISOString()} error=${startResult.error}`,
         );

         const markFailedResult = await Result.tryPromise({
            try: () =>
               DBOS.runStep(
                  () =>
                     markWorkflowRunFailed({
                        runId: run.id,
                        errorMessage: startResult.error,
                     }),
                  { name: `mark-start-failed-${run.id}` },
               ),
            catch: () => "Falha ao marcar execução como falha.",
         });
         if (Result.isError(markFailedResult)) {
            DBOS.logger.error(
               `[workflows-scheduler] Falha ao marcar execução como falha workflow=${workflow.id} run=${run.id} error=${markFailedResult.error}`,
            );
         }

         const scheduleNode = getWorkflowScheduleNode(workflow.graph);
         const nextRunResult = await Result.tryPromise({
            try: () =>
               DBOS.runStep(
                  () =>
                     updateWorkflowNextRunAt({
                        workflowId: workflow.id,
                        cron: scheduleNode.data.cron,
                        timezone: normalizeWorkflowTimezone(
                           scheduleNode.data.timezone,
                        ),
                        scheduledFor,
                     }),
                  { name: `advance-next-run-${workflow.id}` },
               ),
            catch: () => "Falha ao avançar próxima execução.",
         });
         if (Result.isError(nextRunResult)) {
            DBOS.logger.error(
               `[workflows-scheduler] Falha ao avançar próxima execução workflow=${workflow.id} run=${run.id} error=${nextRunResult.error}`,
            );
         }
      }
   }
}

async function pollDueWorkflowsWorkflowFn(
   _scheduledTime: Date,
   _fireDate: Date,
) {
   return pollDueWorkflowsOnce();
}

DBOS.registerScheduled(pollDueWorkflowsWorkflowFn, {
   crontab: "* * * * *",
   queueName: WORKFLOW_SCHEDULER_QUEUE_NAME,
   name: WORKFLOW_SCHEDULER_WORKFLOW_NAME,
});

export const pollDueWorkflowsWorkflow = pollDueWorkflowsWorkflowFn;
