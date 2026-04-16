export const NOTIFICATION_TYPES = {
   AI_KEYWORD_DERIVED: "ai.keyword_derived",
   AI_TRANSACTION_CATEGORIZED: "ai.transaction_categorized",
   CRON_KEYWORDS_BACKFILL: "cron.keywords_backfill",
   IMPORT_BATCH: "import.batch",
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
   "cron.keywords_backfill": {
      count: number;
   };
   "import.batch": {
      importId: string;
      created: number;
      total: number;
   };
};

export function getPayload<T extends keyof NotificationPayloadMap>(
   type: T,
   payload: Record<string, unknown> | undefined,
): NotificationPayloadMap[T] | undefined {
   return payload as NotificationPayloadMap[T] | undefined;
}
