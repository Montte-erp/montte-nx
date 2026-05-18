import { Result } from "better-result";
import type { DatabaseInstance } from "@core/database/client";
import type { PgBossClient } from "@core/pg-boss/client";
import { defaultPgBossWorkOptions } from "@core/pg-boss/worker";
import type { Prompts } from "@core/posthog/server";
import {
   deriveKeywordsDeadLetterQueue,
   deriveKeywordsQueue,
   handleDeriveKeywordsJob,
   type DeriveKeywordsJobInput,
} from "@modules/classification/jobs/derive-keywords-job";

export const classificationPgBossQueues = [
   deriveKeywordsDeadLetterQueue,
   deriveKeywordsQueue,
];

export async function registerClassificationPgBossJobs(options: {
   boss: PgBossClient;
   db: DatabaseInstance;
   prompts: Prompts;
}) {
   await options.boss.work<DeriveKeywordsJobInput>(
      deriveKeywordsQueue.name,
      defaultPgBossWorkOptions,
      async (jobs) => {
         const errors: Error[] = [];
         for (const job of jobs) {
            const result = await handleDeriveKeywordsJob({
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
