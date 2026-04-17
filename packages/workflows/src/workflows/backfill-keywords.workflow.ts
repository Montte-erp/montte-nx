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
import { jobPublisher } from "../publisher";
import { db, redis } from "../singletons";
import { deriveKeywordsWorkflow } from "./derive-keywords.workflow";

async function backfillKeywordsWorkflowFn(
   scheduledTime: Date,
   _context: unknown,
) {
   const teams = await DBOS.runStep(
      async () =>
         (
            await listTeamsWithPendingKeywords(db).andThen((rows) => {
               const teamIds = [...new Set(rows.map((r) => r.teamId))];
               return listTeamMetadataByIds(db, teamIds);
            })
         ).match(
            (teamRows) =>
               teamRows.map((t) => ({
                  teamId: t.id,
                  organizationId: t.organizationId,
               })),
            (e) => {
               throw e;
            },
         ),
      { name: "fetchTeams" },
   );

   for (const team of teams) {
      const pending = await DBOS.runStep(
         async () =>
            (await listCategoriesWithNullKeywords(db, team.teamId, 50)).match(
               (v) => v,
               (e) => {
                  throw e;
               },
            ),
         { name: `fetchPending-${team.teamId}` },
      );

      let processed = 0;

      for (const category of pending) {
         const budgetOk = await DBOS.runStep(
            async () => {
               try {
                  await enforceCreditBudget(
                     team.organizationId,
                     "ai.keyword_derived",
                     redis,
                     null,
                  );
                  return true;
               } catch {
                  return false;
               }
            },
            { name: `budget-${category.id}` },
         );

         if (!budgetOk) break;

         await DBOS.startWorkflow(deriveKeywordsWorkflow, {
            workflowID: `derive-${category.id}-${dayjs(scheduledTime).format("YYYY-MM-DD")}`,
         }).run({
            categoryId: category.id,
            teamId: category.teamId,
            organizationId: team.organizationId,
            name: category.name,
            description: category.description,
         });

         processed++;
      }

      if (processed > 0) {
         await DBOS.runStep(
            () =>
               jobPublisher.publish("job.notification", {
                  jobId: crypto.randomUUID(),
                  type: NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL,
                  status: "completed",
                  message: `Palavras-chave configuradas para ${processed} categorias.`,
                  payload: { count: processed },
                  teamId: team.teamId,
                  timestamp: dayjs().toISOString(),
               } satisfies JobNotification),
            { name: `notify-${team.teamId}` },
         );
      }
   }
}

export const backfillKeywordsWorkflow = DBOS.registerWorkflow(
   backfillKeywordsWorkflowFn,
);
