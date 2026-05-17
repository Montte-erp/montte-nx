import type { DatabaseInstance } from "@core/database/client";
import { Result } from "better-result";
import { defaultPgBossWorkOptions } from "@core/pg-boss/worker";
import type { PgBossClient } from "@core/pg-boss/client";
import type { Prompts } from "@core/posthog/server";
import {
   generateThreadTitleDeadLetterQueue,
   generateThreadTitleQueue,
   handleGenerateThreadTitleJob,
   type GenerateThreadTitleJobInput,
} from "./generate-title-job";
import {
   handleRefreshThreadSuggestionsJob,
   refreshThreadSuggestionsDeadLetterQueue,
   refreshThreadSuggestionsQueue,
   type RefreshThreadSuggestionsJobInput,
} from "./refresh-suggestions-job";

export const agentPgBossQueues = [
   generateThreadTitleDeadLetterQueue,
   generateThreadTitleQueue,
   refreshThreadSuggestionsDeadLetterQueue,
   refreshThreadSuggestionsQueue,
];

export async function registerAgentPgBossJobs(options: {
   boss: PgBossClient;
   db: DatabaseInstance;
   prompts: Prompts;
}) {
   await options.boss.work<GenerateThreadTitleJobInput>(
      generateThreadTitleQueue.name,
      defaultPgBossWorkOptions,
      async (jobs) => {
         const errors: Error[] = [];
         for (const job of jobs) {
            const result = await handleGenerateThreadTitleJob({
               db: options.db,
               prompts: options.prompts,
               job,
            });
            if (Result.isError(result)) errors.push(result.error);
         }
         if (errors.length > 0) {
            throw new AggregateError(errors);
         }
      },
   );
   await options.boss.work<RefreshThreadSuggestionsJobInput>(
      refreshThreadSuggestionsQueue.name,
      defaultPgBossWorkOptions,
      async (jobs) => {
         const errors: Error[] = [];
         for (const job of jobs) {
            const result = await handleRefreshThreadSuggestionsJob({
               db: options.db,
               prompts: options.prompts,
               job,
            });
            if (Result.isError(result)) errors.push(result.error);
         }
         if (errors.length > 0) {
            throw new AggregateError(errors);
         }
      },
   );
}
