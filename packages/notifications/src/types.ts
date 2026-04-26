export const NOTIFICATION_TYPES = {
   BILLING_INVOICE_GENERATED: "billing.invoice_generated",
   BILLING_TRIAL_EXPIRING: "billing.trial_expiring",
   BILLING_BENEFIT_GRANTED: "billing.benefit_granted",
   BILLING_BENEFIT_REVOKED: "billing.benefit_revoked",
   BILLING_USAGE_INGESTED: "billing.usage_ingested",
} as const;

export type NotificationType =
   (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type NotificationPayloadMap = {
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
