import { Result } from "better-result";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { and, asc, eq, lte } from "drizzle-orm";
import dayjs from "dayjs";
import { workflowsDataSource } from "./data-source";
import { workflows } from "@core/database/schemas/workflows";
import {
   createWorkflowRun,
   WORKFLOW_EXECUTE_QUEUE_NAME,
   WORKFLOW_SCHEDULER_QUEUE_NAME,
   WORKFLOW_SCHEDULER_WORKFLOW_NAME,
} from "./runtime";
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
         console.error("Falha ao programar execução do workflow.", {
            workflowId: workflow.id,
            scheduledFor,
            error: runResult.error,
         });
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
         console.error("Falha ao programar execução do workflow.", {
            workflowId: workflow.id,
            scheduledFor,
            error: startResult.error,
         });
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
