import type { Redis } from "@core/redis/connection";
import type { CategorizationInput } from "./workflows/categorization.workflow";
import type { DeriveKeywordsInput } from "./workflows/derive-keywords.workflow";

export const WORKFLOW_QUEUE_KEYS = {
   categorize: "workflow:categorize",
   deriveKeywords: "workflow:derive-keywords",
} as const;

export async function enqueueCategorizationWorkflow(
   redis: Redis,
   input: CategorizationInput,
): Promise<void> {
   await redis.rpush(WORKFLOW_QUEUE_KEYS.categorize, JSON.stringify(input));
}

export async function enqueueDeriveKeywordsWorkflow(
   redis: Redis,
   input: DeriveKeywordsInput,
): Promise<void> {
   await redis.rpush(WORKFLOW_QUEUE_KEYS.deriveKeywords, JSON.stringify(input));
}
