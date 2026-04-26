import { z } from "zod";
import { defineSseEvents, type SseEventOf } from "@core/sse";

const billingEventDefinitions = {
   "billing.trial_expiring": z.object({
      subscriptionId: z.string(),
      trialEndsAt: z.string(),
      daysLeft: z.number().int().nonnegative(),
   }),
   "billing.trial_completed": z.object({
      subscriptionId: z.string(),
   }),
   "billing.invoice_generated": z.object({
      invoiceId: z.string(),
      subscriptionId: z.string(),
      total: z.string(),
      currency: z.string(),
   }),
   "billing.benefit_granted": z.object({
      subscriptionId: z.string(),
      benefitIds: z.array(z.string()),
   }),
   "billing.benefit_revoked": z.object({
      subscriptionId: z.string(),
      benefitIds: z.array(z.string()),
   }),
   "billing.usage_ingested": z.object({
      meterId: z.string(),
      idempotencyKey: z.string(),
   }),
} as const;

export const billingSseEvents = defineSseEvents(billingEventDefinitions);

export type BillingSseEvent = SseEventOf<typeof billingEventDefinitions>;
