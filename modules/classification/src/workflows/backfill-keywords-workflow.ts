import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { categories } from "@core/database/schemas/categories";
import { team } from "@core/database/schemas/auth";
import { WorkflowError } from "@core/dbos/errors";
import { getLogger } from "@core/logging/root";
import { classificationSseEvents } from "../sse";
import { CLASSIFICATION_QUEUES } from "../constants";
import {
   classificationDataSource,
   getClassificationRedis,
   registerWorkflowOnce,
} from "./context";
import { deriveKeywordsWorkflow } from "./derive-keywords-workflow";

const STALE_DAYS = 30;

type StaleCategory = {
   id: string;
   teamId: string;
   name: string;
   description: string | null;
};

async function backfillKeywordsWorkflowFn(scheduledTime: Date, _ctx: unknown) {
   const ctxLog = `[backfill-keywords] scheduledAt=${dayjs(scheduledTime).toISOString()}`;
   DBOS.logger.info(`${ctxLog} started`);

   const loadResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async () => {
                  const tx = classificationDataSource.client;
                  const cutoff = dayjs(scheduledTime)
                     .subtract(STALE_DAYS, "day")
                     .toDate();
                  return tx
                     .select({
                        id: categories.id,
                        teamId: categories.teamId,
                        name: categories.name,
                        description: categories.description,
                     })
                     .from(categories)
                     .where(
                        and(
                           eq(categories.isArchived, false),
                           or(
                              isNull(categories.keywords),
                              lt(categories.keywordsUpdatedAt, cutoff),
                           ),
                        ),
                     );
               },
               { name: "load-stale-categories" },
            ),
         { name: "load-stale-categories" },
      ),
      (e) =>
         WorkflowError.database("Falha ao carregar categorias pendentes.", {
            cause: e,
         }),
   );
   if (loadResult.isErr()) throw loadResult.error;
   const stale = loadResult.value;

   if (stale.length === 0) {
      DBOS.logger.info(`${ctxLog} no stale categories — exiting`);
      return;
   }

   const teamIds = [...new Set(stale.map((c) => c.teamId))];

   const orgMappingResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async () => {
                  const tx = classificationDataSource.client;
                  const rows = await tx
                     .select({
                        id: team.id,
                        organizationId: team.organizationId,
                     })
                     .from(team)
                     .where(inArray(team.id, teamIds));
                  return new Map(rows.map((r) => [r.id, r.organizationId]));
               },
               { name: "load-org-mapping" },
            ),
         { name: "load-org-mapping" },
      ),
      (e) =>
         WorkflowError.database("Falha ao carregar mapeamento de times.", {
            cause: e,
         }),
   );
   if (orgMappingResult.isErr()) throw orgMappingResult.error;
   const orgByTeamId = orgMappingResult.value;

   const byTeam = new Map<string, StaleCategory[]>();
   for (const row of stale) {
      const list = byTeam.get(row.teamId) ?? [];
      list.push(row);
      byTeam.set(row.teamId, list);
   }

   const dateSuffix = dayjs(scheduledTime).format("YYYY-MM-DD");
   let totalEnqueued = 0;
   let teamsProcessed = 0;

   for (const [teamId, items] of byTeam) {
      const organizationId = orgByTeamId.get(teamId);
      if (!organizationId) {
         DBOS.logger.warn(
            `${ctxLog} team=${teamId} skipped — no organization mapping`,
         );
         continue;
      }
      for (const item of items) {
         await DBOS.startWorkflow(deriveKeywordsWorkflow, {
            workflowID: `derive-category-${item.id}-${dateSuffix}`,
            queueName: `workflow:${CLASSIFICATION_QUEUES.deriveKeywords}`,
         })({
            categoryId: item.id,
            teamId,
            organizationId,
            name: item.name,
            description: item.description,
         });
         totalEnqueued++;
      }
      if (items.length > 0) {
         teamsProcessed++;
         await emitBackfillSse({ teamId, processed: items.length });
      }
   }

   DBOS.logger.info(
      `${ctxLog} completed — teams=${teamsProcessed} enqueued=${totalEnqueued}`,
   );
}

async function emitBackfillSse(args: { teamId: string; processed: number }) {
   await DBOS.runStep(
      async () => {
         const logger = getLogger();
         const publish = await classificationSseEvents.publish(
            getClassificationRedis(),
            { kind: "team", id: args.teamId },
            {
               type: "classification.keywords_backfilled",
               payload: { processed: args.processed },
            },
         );
         if (publish.isErr()) {
            logger.warn(
               { err: publish.error, teamId: args.teamId },
               "Failed to publish keywords_backfilled SSE event",
            );
         }
      },
      { name: `emit-sse-${args.teamId}` },
   );
}

export const backfillKeywordsWorkflow = registerWorkflowOnce(
   backfillKeywordsWorkflowFn,
   { name: "backfillKeywordsWorkflow" },
);
