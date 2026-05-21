import { DBOS } from "@dbos-inc/dbos-sdk";
import { and, asc, eq, lte } from "drizzle-orm";
import dayjs from "dayjs";
import { workflowsDataSource } from "./data-source";
import { workflows } from "./schema";
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
      const run = await DBOS.runStep(
         () =>
            createWorkflowRun({
               workflowId: workflow.id,
               scheduledFor,
               triggeredBy: "schedule",
            }),
         { name: `create-workflow-run-${workflow.id}` },
      );
      if (!run) continue;
      await DBOS.startWorkflow(executeWorkflowWorkflow, {
         workflowID: run.id,
         queueName: WORKFLOW_EXECUTE_QUEUE_NAME,
      })({
         workflowId: workflow.id,
         runId: run.id,
         scheduledFor,
         triggeredBy: "schedule",
      });
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
