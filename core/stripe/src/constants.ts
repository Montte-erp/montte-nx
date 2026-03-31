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
   "finance.transaction_created": 1000,
   "finance.recurring_processed": 200,
   "finance.bill_auto_generated": 100,
   "finance.statement_imported": 10,
   "finance.reconciliation_run": 10,
   "ai.keyword_derived": 100,
   "ai.chat_message": 30,
   "ai.tool_call": 50,
   "ai.whatsapp_reply": 20,
   "ai.workflow_run": 5,
   "workflow.step_executed": 200,
   "workflow.run": 50,
   "contact.created": 200,
   "crm.deal_created": 100,
   "crm.whatsapp_sent": 30,
   "crm.charge_created": 20,
   "document.created": 20,
   "inventory.item_created": 200,
   "service.created": 100,
   "coworking.checkin": 200,
   "coworking.booking_created": 100,
   "webhook.delivered": 1000,
   "webhook.received": 1000,
   "payment.subscription_billed": 10,
   "payment.processed": 10,
};

export const EVENT_PRICES: Record<string, string> = {
   "finance.transaction_created": "0.001000",
   "finance.recurring_processed": "0.002000",
   "finance.bill_auto_generated": "0.005000",
   "finance.statement_imported": "0.020000",
   "finance.reconciliation_run": "0.050000",
   "ai.keyword_derived": "0.010000",
   "ai.chat_message": "0.020000",
   "ai.tool_call": "0.030000",
   "ai.whatsapp_reply": "0.050000",
   "ai.workflow_run": "0.100000",
   "workflow.step_executed": "0.010000",
   "workflow.run": "0.020000",
   "contact.created": "0.010000",
   "crm.deal_created": "0.010000",
   "crm.whatsapp_sent": "0.030000",
   "crm.charge_created": "0.050000",
   "document.created": "0.020000",
   "inventory.item_created": "0.010000",
   "service.created": "0.010000",
   "coworking.checkin": "0.002000",
   "coworking.booking_created": "0.005000",
   "webhook.delivered": "0.000500",
   "webhook.received": "0.001000",
   "payment.subscription_billed": "0.020000",
   "payment.processed": "0.050000",
};

export const STRIPE_METER_EVENTS: Record<string, string> = {
   "finance.transaction_created": "finance_transactions",
   "finance.recurring_processed": "finance_recurring_processed",
   "finance.bill_auto_generated": "finance_bill_auto_generated",
   "finance.statement_imported": "finance_statement_imported",
   "finance.reconciliation_run": "finance_reconciliation_run",
   "ai.keyword_derived": "ai_keyword_derived",
   "ai.chat_message": "ai_chat_messages",
   "ai.tool_call": "ai_tool_calls",
   "ai.whatsapp_reply": "ai_whatsapp_replies",
   "ai.workflow_run": "ai_workflow_runs",
   "workflow.step_executed": "workflow_steps_executed",
   "workflow.run": "workflow_runs",
   "contact.created": "contact_creates",
   "crm.deal_created": "crm_deals_created",
   "crm.whatsapp_sent": "crm_whatsapp_sent",
   "crm.charge_created": "crm_charges_created",
   "document.created": "document_creates",
   "inventory.item_created": "inventory_creates",
   "service.created": "service_creates",
   "coworking.checkin": "coworking_checkins",
   "coworking.booking_created": "coworking_bookings_created",
   "webhook.delivered": "webhook_deliveries",
   "webhook.received": "webhook_received",
   "payment.subscription_billed": "payment_subscriptions_billed",
   "payment.processed": "payment_processed",
};
