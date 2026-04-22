export const NOTIFICATION_TYPES = {
   AI_KEYWORD_DERIVED: "ai.keyword_derived",
   AI_TRANSACTION_CATEGORIZED: "ai.transaction_categorized",
   AI_TAG_KEYWORD_DERIVED: "ai.tag_keyword_derived",
   AI_TAG_SUGGESTED: "ai.tag_suggested",
   CRON_KEYWORDS_BACKFILL: "cron.keywords_backfill",
   NFSE_EMISSION_COMPLETED: "nfse.emission_completed",
} as const;

export type NotificationType =
   (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type NotificationPayloadMap = {
   "ai.keyword_derived": {
      categoryId: string;
      categoryName: string;
      count: number;
   };
   "ai.transaction_categorized": {
      transactionId: string;
   };
   "ai.tag_keyword_derived": {
      tagId: string;
      tagName: string;
      count: number;
   };
   "ai.tag_suggested": {
      transactionId: string;
   };
   "cron.keywords_backfill": {
      count: number;
   };
   "nfse.emission_completed": {
      numeroNota: string;
   };
};

export function getPayload<T extends keyof NotificationPayloadMap>(
   type: T,
   payload: Record<string, unknown> | undefined,
): NotificationPayloadMap[T] | undefined {
   return payload as NotificationPayloadMap[T] | undefined;
}
