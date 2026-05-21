import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
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
            name: "workflow:workflows/execute",
            options: { workerConcurrency: deps?.workerConcurrency ?? 10 },
         },
         {
            name: "workflow:workflows/scheduler",
            options: { workerConcurrency: 1 },
         },
      ],
   };
}
