import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { team } from "@core/database/schemas/auth";
import { WorkflowError } from "@core/dbos/errors";
import { getLogger } from "@core/logging/root";
import { enforceCreditBudget } from "@packages/events/credits";
import { classificationSseEvents } from "../sse/events";
import { CLASSIFICATION_QUEUES } from "../constants";
import { classificationDataSource, getClassificationRedis } from "./context";
import {
   deriveKeywordsWorkflow,
   type DeriveKeywordsWorkflowInput,
} from "./derive-keywords-workflow";

const STALE_DAYS = 30;

type StaleEntity = {
   id: string;
   teamId: string;
   name: string;
   description: string | null;
};

type TeamBatch = {
   teamId: string;
   categories: StaleEntity[];
   tags: StaleEntity[];
};

async function backfillKeywordsWorkflowFn(scheduledTime: Date, _ctx: unknown) {
   const ctxLog = `[backfill-keywords] scheduledAt=${dayjs(scheduledTime).toISOString()}`;
   DBOS.logger.info(`${ctxLog} started`);

   const loadResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async (): Promise<TeamBatch[]> => {
                  const tx = classificationDataSource.client;
                  const cutoff = dayjs(scheduledTime)
                     .subtract(STALE_DAYS, "day")
                     .toDate();

                  const staleCategories = await tx
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

                  const staleTags = await tx
                     .select({
                        id: tags.id,
                        teamId: tags.teamId,
                        name: tags.name,
                        description: tags.description,
                     })
                     .from(tags)
                     .where(
                        and(eq(tags.isArchived, false), isNull(tags.keywords)),
                     );

                  const teamMap = new Map<string, TeamBatch>();
                  for (const row of staleCategories) {
                     const existing = teamMap.get(row.teamId) ?? {
                        teamId: row.teamId,
                        categories: [],
                        tags: [],
                     };
                     existing.categories.push(row);
                     teamMap.set(row.teamId, existing);
                  }
                  for (const row of staleTags) {
                     const existing = teamMap.get(row.teamId) ?? {
                        teamId: row.teamId,
                        categories: [],
                        tags: [],
                     };
                     existing.tags.push(row);
                     teamMap.set(row.teamId, existing);
                  }
                  return [...teamMap.values()];
               },
               { name: "load-stale-entities" },
            ),
         { name: "load-stale-entities" },
      ),
      (e) =>
         WorkflowError.database("Falha ao carregar entidades pendentes.", {
            cause: e,
         }),
   );
   if (loadResult.isErr()) throw loadResult.error;
   const batches = loadResult.value;

   if (batches.length === 0) {
      DBOS.logger.info(`${ctxLog} no stale entities — exiting`);
      return;
   }

   const orgMappingResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async () => {
                  const tx = classificationDataSource.client;
                  const teamIds = batches.map((b) => b.teamId);
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

   const redis = getClassificationRedis();
   const logger = getLogger();
   const dateSuffix = dayjs(scheduledTime).format("YYYY-MM-DD");
   let totalEnqueued = 0;
   let teamsProcessed = 0;

   for (const batch of batches) {
      const organizationId = orgByTeamId.get(batch.teamId);
      if (!organizationId) {
         DBOS.logger.warn(
            `${ctxLog} team=${batch.teamId} skipped — no organization mapping found`,
         );
         continue;
      }

      let teamHadProgress = false;

      const categoryProcessed = await processEntities({
         entities: batch.categories,
         entity: "category",
         teamId: batch.teamId,
         organizationId,
         dateSuffix,
      });
      totalEnqueued += categoryProcessed;
      if (categoryProcessed > 0) {
         teamHadProgress = true;
         await DBOS.runStep(
            async () => {
               const publish = await classificationSseEvents.publish(
                  redis,
                  { kind: "team", id: batch.teamId },
                  {
                     type: "classification.keywords_backfilled",
                     payload: {
                        entity: "category",
                        processed: categoryProcessed,
                     },
                  },
               );
               if (publish.isErr()) {
                  logger.warn(
                     {
                        err: publish.error,
                        entity: "category",
                        teamId: batch.teamId,
                     },
                     "Failed to publish keywords_backfilled SSE event",
                  );
               }
            },
            { name: `emit-sse-categories-${batch.teamId}` },
         );
      }

      const tagProcessed = await processEntities({
         entities: batch.tags,
         entity: "tag",
         teamId: batch.teamId,
         organizationId,
         dateSuffix,
      });
      totalEnqueued += tagProcessed;
      if (tagProcessed > 0) {
         teamHadProgress = true;
         await DBOS.runStep(
            async () => {
               const publish = await classificationSseEvents.publish(
                  redis,
                  { kind: "team", id: batch.teamId },
                  {
                     type: "classification.keywords_backfilled",
                     payload: {
                        entity: "tag",
                        processed: tagProcessed,
                     },
                  },
               );
               if (publish.isErr()) {
                  logger.warn(
                     {
                        err: publish.error,
                        entity: "tag",
                        teamId: batch.teamId,
                     },
                     "Failed to publish keywords_backfilled SSE event",
                  );
               }
            },
            { name: `emit-sse-tags-${batch.teamId}` },
         );
      }

      if (teamHadProgress) teamsProcessed++;
   }

   DBOS.logger.info(
      `${ctxLog} completed — teams=${teamsProcessed} enqueued=${totalEnqueued}`,
   );
}

async function processEntities(args: {
   entities: StaleEntity[];
   entity: "category" | "tag";
   teamId: string;
   organizationId: string;
   dateSuffix: string;
}): Promise<number> {
   const { entities, entity, teamId, organizationId, dateSuffix } = args;
   if (entities.length === 0) return 0;

   const redis = getClassificationRedis();
   const eventName =
      entity === "category" ? "ai.keyword_derived" : "ai.tag_keyword_derived";

   let processed = 0;
   for (const item of entities) {
      const budgetResult = await fromPromise(
         enforceCreditBudget(organizationId, eventName, redis, null),
         (e) => e,
      );
      if (budgetResult.isErr()) {
         DBOS.logger.info(
            `[backfill-keywords] team=${teamId} entity=${entity} budget exhausted at ${processed}/${entities.length}`,
         );
         break;
      }

      const workflowID = `derive-${entity}-${item.id}-${dateSuffix}`;
      const input: DeriveKeywordsWorkflowInput =
         entity === "category"
            ? {
                 entity: "category",
                 categoryId: item.id,
                 teamId,
                 organizationId,
                 name: item.name,
                 description: item.description,
              }
            : {
                 entity: "tag",
                 tagId: item.id,
                 teamId,
                 organizationId,
                 name: item.name,
                 description: item.description,
              };

      await DBOS.startWorkflow(deriveKeywordsWorkflow, {
         workflowID,
         queueName: `workflow:${CLASSIFICATION_QUEUES.deriveKeywords}`,
      })(input);

      processed++;
   }

   return processed;
}

export const backfillKeywordsWorkflow = DBOS.registerWorkflow(
   backfillKeywordsWorkflowFn,
   { name: "backfillKeywordsWorkflow" },
);
