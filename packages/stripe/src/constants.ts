// ---------------------------------------------------------------------------
// Addon Names (Stripe products — platform addons and messaging)
// ---------------------------------------------------------------------------

export enum AddonName {
   BOOST = "boost",
   SCALE = "scale",
   ENTERPRISE = "enterprise",
   TELEGRAM = "telegram",
   WHATSAPP = "whatsapp",
   MENSAGERIA_BUNDLE = "mensageria-bundle",
}

// ---------------------------------------------------------------------------
// Free tier limits per billable event (resets monthly via Redis TTL)
// Enforced in-app — Stripe only bills overages above these limits.
// ---------------------------------------------------------------------------

export const FREE_TIER_LIMITS: Record<string, number> = {
   "finance.transaction_created": 500,
   "ai.chat_message": 20,
   "ai.agent_action": 5,
   "webhook.delivered": 500,
   "contact.created": 50,
   "inventory.item_created": 50,
   "service.created": 20,
   "nfe.emitted": 5,
   "document.signed": 10,
};

// ---------------------------------------------------------------------------
// Metered price per event in BRL (6 decimal places)
// ---------------------------------------------------------------------------

export const EVENT_PRICES: Record<string, string> = {
   "finance.transaction_created": "0.001000",
   "ai.chat_message": "0.020000",
   "ai.agent_action": "0.040000",
   "webhook.delivered": "0.000500",
   "contact.created": "0.010000",
   "inventory.item_created": "0.010000",
   "service.created": "0.010000",
   "nfe.emitted": "0.150000",
   "document.signed": "0.100000",
};

// ---------------------------------------------------------------------------
// Stripe Meter Event Names
// These must match the meter event names created in the Stripe dashboard.
// ---------------------------------------------------------------------------

export const STRIPE_METER_EVENTS: Record<string, string> = {
   "finance.transaction_created": "finance_transactions",
   "ai.chat_message": "ai_chat_messages",
   "ai.agent_action": "ai_agent_actions",
   "webhook.delivered": "webhook_deliveries",
   "contact.created": "contact_creates",
   "inventory.item_created": "inventory_creates",
   "service.created": "service_creates",
   "nfe.emitted": "nfe_emissions",
   "document.signed": "document_signatures",
};
