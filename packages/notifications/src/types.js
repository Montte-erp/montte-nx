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
};
export function getPayload(type, payload) {
   return payload;
}
