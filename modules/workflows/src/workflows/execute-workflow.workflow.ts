import { DBOS } from "@dbos-inc/dbos-sdk";
import { Result } from "better-result";
import { registerWorkflowOnce } from "@core/dbos/factory";
import {
   buildWorkflowReportConfig,
   computeWorkflowPeriod,
   createWorkflowReport,
   getWorkflowActionNode,
   getWorkflowScheduleNode,
   loadWorkflowById,
   loadWorkflowRunById,
   markWorkflowRunFailed,
   markWorkflowRunRunning,
   markWorkflowRunSucceeded,
   renderWorkflowName,
   updateWorkflowNextRunAt,
   WORKFLOW_EXECUTE_WORKFLOW_NAME,
} from "../runtime";

async function executeWorkflowWorkflowFn(input: {
   workflowId: string;
   runId: string;
   scheduledFor: Date;
   triggeredBy: "schedule" | "manual";
}) {
   const workflow = await DBOS.runStep(
      () => loadWorkflowById(input.workflowId),
      { name: "load-workflow" },
   );
   const run = await DBOS.runStep(() => loadWorkflowRunById(input.runId), {
      name: "load-workflow-run",
   });
   const scheduleNode = getWorkflowScheduleNode(workflow.graph);
   const actionNode = getWorkflowActionNode(workflow.graph);
   const scheduledFor = run.scheduledFor ?? input.scheduledFor;
   const period = computeWorkflowPeriod(
      actionNode.data.period.kind,
      scheduledFor,
      scheduleNode.data.timezone,
   );
   const reportConfig = buildWorkflowReportConfig({
      reportType: actionNode.data.reportType,
      period,
      timezone: scheduleNode.data.timezone,
   });
   const reportName = renderWorkflowName(
      actionNode.data.nameTemplate,
      period,
      scheduleNode.data.timezone,
   );

   const result = await Result.tryPromise({
      try: async () => {
         await DBOS.runStep(() => markWorkflowRunRunning(run.id), {
            name: "mark-workflow-run-running",
         });
         const report = await DBOS.runStep(
            () =>
               createWorkflowReport({
                  teamId: workflow.teamId,
                  type: actionNode.data.reportType,
                  name: reportName,
                  config: reportConfig,
               }),
            { name: "create-workflow-report" },
         );
         await DBOS.runStep(
            () =>
               markWorkflowRunSucceeded({ runId: run.id, reportId: report.id }),
            { name: "mark-workflow-run-succeeded" },
         );
         if (run.triggeredBy === "schedule") {
            await DBOS.runStep(
               () =>
                  updateWorkflowNextRunAt({
                     workflowId: workflow.id,
                     cron: scheduleNode.data.cron,
                     timezone: scheduleNode.data.timezone,
                     scheduledFor,
                  }),
               { name: "update-workflow-next-run-at" },
            );
         }
         return report;
      },
      catch: (cause) => cause,
   });

   if (Result.isError(result)) {
      await DBOS.runStep(
         () =>
            markWorkflowRunFailed({
               runId: run.id,
               errorMessage:
                  result.error instanceof Error
                     ? result.error.message
                     : "Falha ao executar workflow.",
            }),
         { name: "mark-workflow-run-failed" },
      );
      if (run.triggeredBy === "schedule") {
         await DBOS.runStep(
            () =>
               updateWorkflowNextRunAt({
                  workflowId: workflow.id,
                  cron: scheduleNode.data.cron,
                  timezone: scheduleNode.data.timezone,
                  scheduledFor,
               }),
            { name: "update-workflow-next-run-at-failed" },
         );
      }
      throw result.error;
   }

   return result.value;
}

export const executeWorkflowWorkflow = registerWorkflowOnce(
   executeWorkflowWorkflowFn,
   { name: WORKFLOW_EXECUTE_WORKFLOW_NAME },
);
