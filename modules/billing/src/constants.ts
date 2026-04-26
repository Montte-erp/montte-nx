export const BILLING_QUEUES = {
   benefitLifecycle: "benefit-lifecycle",
   periodEndInvoice: "period-end-invoice",
   trialExpiry: "trial-expiry",
} as const;

export type BillingQueueName =
   (typeof BILLING_QUEUES)[keyof typeof BILLING_QUEUES];
