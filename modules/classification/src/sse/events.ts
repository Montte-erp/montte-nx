import { z } from "zod";
import { defineSseEvents, type SseEventOf } from "@core/sse/define";

const classificationEventDefinitions = {
   "classification.transaction_classified": z.object({
      transactionId: z.string(),
      categoryId: z.string(),
      tagId: z.string().nullable(),
   }),
   "classification.keywords_derived": z.object({
      entity: z.enum(["category", "tag"]),
      entityId: z.string(),
      entityName: z.string(),
      count: z.number().int().nonnegative(),
   }),
   "classification.keywords_backfilled": z.object({
      entity: z.enum(["category", "tag"]),
      processed: z.number().int().nonnegative(),
   }),
} as const;

export const classificationSseEvents = defineSseEvents(
   classificationEventDefinitions,
);

export type ClassificationSseEvent = SseEventOf<
   typeof classificationEventDefinitions
>;
