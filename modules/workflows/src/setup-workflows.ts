import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
import {
   WORKFLOW_EXECUTE_QUEUE_NAME,
   WORKFLOW_SCHEDULER_QUEUE_NAME,
} from "./runtime-constants";
import { executeWorkflowWorkflow } from "./workflows/execute-workflow.workflow";
import { pollDueWorkflowsWorkflow } from "./scheduler";

export async function setupWorkflowsWorkflows(deps?: {
   workerConcurrency?: number;
}) {
   await DrizzleDataSource.initializeDBOSSchema({
      connectionString: env.DATABASE_URL,
   });

   void executeWorkflowWorkflow;
   void pollDueWorkflowsWorkflow;

   return {
      queues: [
         {
            name: WORKFLOW_EXECUTE_QUEUE_NAME,
            options: { workerConcurrency: deps?.workerConcurrency ?? 10 },
         },
         {
            name: WORKFLOW_SCHEDULER_QUEUE_NAME,
            options: { workerConcurrency: 1 },
         },
      ],
   };
}
