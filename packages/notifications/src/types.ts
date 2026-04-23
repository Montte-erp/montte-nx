export const NOTIFICATION_TYPES = {
   AI_KEYWORD_DERIVED: "ai.keyword_derived",
   AI_TRANSACTION_CATEGORIZED: "ai.transaction_categorized",
   AI_TAG_KEYWORD_DERIVED: "ai.tag_keyword_derived",
   AI_TAG_SUGGESTED: "ai.tag_suggested",
   CRON_KEYWORDS_BACKFILL: "cron.keywords_backfill",
   BILLING_INVOICE_GENERATED: "billing.invoice_generated",
   BILLING_TRIAL_EXPIRING: "billing.trial_expiring",
   BILLING_BENEFIT_GRANTED: "billing.benefit_granted",
   BILLING_BENEFIT_REVOKED: "billing.benefit_revoked",
   BILLING_USAGE_INGESTED: "billing.usage_ingested",
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
   "billing.invoice_generated": {
      invoiceId: string;
      subscriptionId: string;
      total: string;
      currency: string;
   };
   "billing.trial_expiring": {
      subscriptionId: string;
      trialEndsAt: string;
      daysLeft: number;
   };
   "billing.benefit_granted": { subscriptionId: string; benefitIds: string[] };
   "billing.benefit_revoked": { subscriptionId: string; benefitIds: string[] };
   "billing.usage_ingested": { meterId: string; idempotencyKey: string };
};

export function getPayload<T extends keyof NotificationPayloadMap>(
   type: T,
   payload: Record<string, unknown> | undefined,
): NotificationPayloadMap[T] | undefined {
   return payload as NotificationPayloadMap[T] | undefined;
}
