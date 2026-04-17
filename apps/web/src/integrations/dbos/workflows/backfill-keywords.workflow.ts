import dayjs from "dayjs";
import { DBOS } from "@dbos-inc/dbos-sdk";
import {
   listTeamsWithPendingKeywords,
   listCategoriesWithNullKeywords,
   listTeamMetadataByIds,
} from "@core/database/repositories/categories-repository";
import { enforceCreditBudget } from "@packages/events/credits";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { jobPublisher } from "@/integrations/dbos/publisher";
import { db, redis } from "@/integrations/singletons";
import { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";

export class BackfillKeywordsWorkflow {
   @DBOS.scheduled({ crontab: "0 3 * * *" })
   @DBOS.workflow()
   static async runDaily(_scheduledTime: Date, _startTime: Date) {
      const teams = await BackfillKeywordsWorkflow.fetchTeamsWithPendingStep();
      for (const t of teams) {
         await BackfillKeywordsWorkflow.processTeamStep(t);
      }
   }

   @DBOS.step()
   static async fetchTeamsWithPendingStep() {
      const rowsResult = await listTeamsWithPendingKeywords(db);
      if (rowsResult.isErr()) throw rowsResult.error;
      const teamIds = [...new Set(rowsResult.value.map((r) => r.teamId))];
      const teamRowsResult = await listTeamMetadataByIds(db, teamIds);
      if (teamRowsResult.isErr()) throw teamRowsResult.error;
      return teamRowsResult.value.map((t) => ({
         teamId: t.id,
         organizationId: t.organizationId,
      }));
   }

   @DBOS.step()
   static async processTeamStep(teamEntry: {
      teamId: string;
      organizationId: string;
   }) {
      const pendingResult = await listCategoriesWithNullKeywords(
         db,
         teamEntry.teamId,
         50,
      );
      if (pendingResult.isErr()) throw pendingResult.error;
      const pending = pendingResult.value;

      let processed = 0;

      for (const category of pending) {
         try {
            await enforceCreditBudget(
               teamEntry.organizationId,
               "ai.keyword_derived",
               redis,
               null,
            );
         } catch {
            break;
         }

         await DBOS.startWorkflow(DeriveKeywordsWorkflow, {
            workflowID: `derive-${category.id}-${dayjs().format("YYYY-MM-DD")}`,
         }).run({
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
            message: `Palavras-chave configuradas para ${processed} categorias.`,
            payload: { count: processed },
            teamId: teamEntry.teamId,
            timestamp: dayjs().toISOString(),
         };
         await jobPublisher.publish("job.notification", notification);
      }
   }
}
