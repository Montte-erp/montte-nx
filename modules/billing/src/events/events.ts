import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "@packages/events/catalog";

export const subscriptionCreatedSchema = z.object({
   subscriptionId: z.string().uuid(),
   contactId: z.string().uuid(),
   serviceId: z.string().uuid().optional(),
});
export type SubscriptionCreatedEvent = z.infer<
   typeof subscriptionCreatedSchema
>;
export function emitSubscriptionCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: SubscriptionCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: "subscription.created",
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}

export const usageIngestedSchema = z.object({
   meterId: z.string().uuid(),
   contactId: z.string().uuid().optional(),
   idempotencyKey: z.string(),
});
export type UsageIngestedEvent = z.infer<typeof usageIngestedSchema>;
export function emitUsageIngested(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: UsageIngestedEvent,
) {
   return emit({
      ...ctx,
      eventName: "usage.ingested",
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}
