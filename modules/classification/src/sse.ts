import { z } from "zod";
import { defineSseEvents, type SseEventOf } from "@core/sse";

const classificationEventDefinitions = {
   "classification.transaction_classified": z.object({
      transactionId: z.string(),
      categoryId: z.string(),
      tagId: z.string().nullable(),
   }),
   "classification.keywords_derived": z.object({
      categoryId: z.string(),
      categoryName: z.string(),
      count: z.number().int().nonnegative(),
   }),
   "classification.batch_started": z.object({
      batchId: z.string(),
      total: z.number().int().nonnegative(),
   }),
   "classification.batch_progress": z.object({
      batchId: z.string(),
      total: z.number().int().nonnegative(),
      processed: z.number().int().nonnegative(),
   }),
   "classification.batch_completed": z.object({
      batchId: z.string(),
      total: z.number().int().nonnegative(),
      classified: z.number().int().nonnegative(),
   }),
} as const;

export const classificationSseEvents = defineSseEvents(
   classificationEventDefinitions,
);

export type ClassificationSseEvent = SseEventOf<
   typeof classificationEventDefinitions
>;
