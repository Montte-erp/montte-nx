import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import { AGENT_QUEUES } from "../constants";

export { createEnqueuer, registerWorkflowOnce } from "@core/dbos/factory";

export const agentsDataSource = new DrizzleDataSource<DatabaseInstance>(
   "agents",
   { connectionString: env.DATABASE_URL },
   schema,
);

type AgentsWorkflowContext = {
   redis: Redis | null;
};

const store = createStore<AgentsWorkflowContext>({ redis: null });

export function initAgentsWorkflowContext(redis: Redis) {
   store.setState(() => ({ redis }));
}

export function getAgentsRedis(): Redis {
   const { redis } = store.state;
   if (!redis) throw new Error("Agents workflow context not initialized");
   return redis;
}

export function createAgentsQueues(options: { workerConcurrency: number }) {
   return Object.values(AGENT_QUEUES).map(
      (name) => new WorkflowQueue(`workflow:${name}`, options),
   );
}
