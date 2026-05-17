import type { DatabaseInstance } from "@core/database/client";
import { Result } from "better-result";
import { defaultPgBossWorkOptions } from "@core/pg-boss/worker";
import type { PgBossClient } from "@core/pg-boss/client";
import type { Prompts } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import {
   generateThreadTitleDeadLetterQueue,
   generateThreadTitleQueue,
   handleGenerateThreadTitleJob,
   type GenerateThreadTitleJobInput,
} from "./generate-title-job";

export const agentPgBossQueues = [
   generateThreadTitleDeadLetterQueue,
   generateThreadTitleQueue,
];

export async function registerAgentPgBossJobs(options: {
   boss: PgBossClient;
   db: DatabaseInstance;
   prompts: Prompts;
   redis: Redis;
}) {
   await options.boss.work<GenerateThreadTitleJobInput>(
      generateThreadTitleQueue.name,
      defaultPgBossWorkOptions,
      async (jobs) => {
         for (const job of jobs) {
            const result = await handleGenerateThreadTitleJob({
               db: options.db,
               prompts: options.prompts,
               redis: options.redis,
               job,
            });
            if (Result.isError(result)) throw result.error;
         }
      },
   );
}
