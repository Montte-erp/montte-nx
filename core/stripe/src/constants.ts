// ---------------------------------------------------------------------------
// Addon Names (Stripe products — platform addons)
// ---------------------------------------------------------------------------

export enum AddonName {
   BOOST = "boost",
   SCALE = "scale",
   ENTERPRISE = "enterprise",
}

// ---------------------------------------------------------------------------
// Free tier limits per billable event (resets monthly via Redis TTL)
// Enforced in-app — Stripe only bills overages above these limits.
// ---------------------------------------------------------------------------

export const FREE_TIER_LIMITS: Record<string, number> = {
   "finance.transaction_created": 500,
   "webhook.delivered": 500,
   "contact.created": 50,
   "inventory.item_created": 50,
   "service.created": 20,
   "finance.statement_imported": 10,
   "ai.keyword_derived": 100,
   "notifications.delivered": 1000,
};

export const EVENT_PRICES: Record<string, string> = {
   "finance.transaction_created": "0.001000",
   "webhook.delivered": "0.000500",
   "contact.created": "0.010000",
   "inventory.item_created": "0.010000",
   "service.created": "0.010000",
   "finance.statement_imported": "0.020000",
   "ai.keyword_derived": "0.010000",
   "notifications.delivered": "0.001000",
};

export const STRIPE_METER_EVENTS: Record<string, string> = {
   "finance.transaction_created": "finance_transactions",
   "webhook.delivered": "webhook_deliveries",
   "contact.created": "contact_creates",
   "inventory.item_created": "inventory_creates",
   "service.created": "service_creates",
   "finance.statement_imported": "finance_statement_imports",
   "ai.keyword_derived": "ai_keyword_derived",
   "notifications.delivered": "notifications_delivered",
};
