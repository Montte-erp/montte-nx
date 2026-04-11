import { DBOS } from "@dbos-inc/dbos-sdk";
import { ResultAsync } from "neverthrow";
import { AppError } from "@core/logging/errors";
import { isNull, eq } from "drizzle-orm";
import { categories } from "@core/database/schemas/categories";
import { team } from "@core/database/schemas/auth";
import { enforceCreditBudget } from "@packages/events/credits";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { jobPublisher } from "../publisher";
import { db, redis } from "../singletons";
import { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";

export class BackfillKeywordsWorkflow {
   @DBOS.scheduled({ crontab: "0 3 * * *" })
   @DBOS.workflow()
   static async runDaily(
      _scheduledTime: Date,
      _actualTime: Date,
   ): Promise<void> {
      const teams = await BackfillKeywordsWorkflow.fetchTeamsWithPendingStep();
      for (const t of teams) {
         await BackfillKeywordsWorkflow.processTeamStep(t);
      }
   }

   @DBOS.step()
   static async fetchTeamsWithPendingStep(): Promise<
      { teamId: string; organizationId: string }[]
   > {
      const rows = await db
         .selectDistinct({
            teamId: categories.teamId,
            organizationId: team.organizationId,
         })
         .from(categories)
         .innerJoin(team, eq(team.id, categories.teamId))
         .where(isNull(categories.keywords));

      return rows;
   }

   @DBOS.step()
   static async processTeamStep(teamEntry: {
      teamId: string;
      organizationId: string;
   }): Promise<void> {
      const pending = await db
         .select()
         .from(categories)
         .where(isNull(categories.keywords))
         .limit(50);

      let processed = 0;

      for (const category of pending) {
         const budgetOk = await ResultAsync.fromPromise(
            enforceCreditBudget(
               teamEntry.organizationId,
               "ai.keyword_derived",
               redis,
               null,
            ),
            () => AppError.forbidden("Free tier exhausted"),
         );

         if (budgetOk.isErr()) break;

         await DBOS.startWorkflow(DeriveKeywordsWorkflow).run({
            categoryId: category.id,
            teamId: category.teamId,
            organizationId: teamEntry.organizationId,
            name: category.name,
            description: category.description,
         });

         processed++;
      }

      if (processed > 0) {
         const notification: JobNotification = {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL,
            status: "completed",
            payload: { count: processed },
            teamId: teamEntry.teamId,
            timestamp: new Date().toISOString(),
         };
         await jobPublisher.publish("job.notification", notification);
      }
   }
}
