import "./generate-title-workflow";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import { createAgentsQueues, initAgentsWorkflowContext } from "./context";

export async function setupAgentsWorkflows(deps: {
   redis: Redis;
   workerConcurrency: number;
}) {
   await DrizzleDataSource.initializeDBOSSchema({
      connectionString: env.DATABASE_URL,
   });
   initAgentsWorkflowContext(deps.redis);
   return createAgentsQueues({ workerConcurrency: deps.workerConcurrency });
}
