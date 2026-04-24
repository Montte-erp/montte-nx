export const BILLING_EVENTS = {
   subscriptionCreated: "subscription.created",
   usageIngested: "usage.ingested",
   meterCreated: "service.meter_created",
   benefitCreated: "service.benefit_created",
} as const;

export type BillingEventName =
   (typeof BILLING_EVENTS)[keyof typeof BILLING_EVENTS];
