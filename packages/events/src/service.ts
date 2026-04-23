import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const SERVICE_EVENTS = {
   "service.created": "service.created",
   "service.updated": "service.updated",
   "service.deleted": "service.deleted",
   "service.meter_created": "service.meter_created",
   "service.benefit_created": "service.benefit_created",
   "subscription.created": "subscription.created",
   "usage.ingested": "usage.ingested",
} as const;

export type ServiceEventName =
   (typeof SERVICE_EVENTS)[keyof typeof SERVICE_EVENTS];

export const serviceCreatedSchema = z.object({
   serviceId: z.string().uuid(),
   name: z.string(),
});
export type ServiceCreatedEvent = z.infer<typeof serviceCreatedSchema>;
export function emitServiceCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ServiceCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: SERVICE_EVENTS["service.created"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}

export const serviceUpdatedSchema = z.object({
   serviceId: z.string().uuid(),
   changedFields: z.array(z.string()),
});
export type ServiceUpdatedEvent = z.infer<typeof serviceUpdatedSchema>;
export function emitServiceUpdated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ServiceUpdatedEvent,
) {
   return emit({
      ...ctx,
      eventName: SERVICE_EVENTS["service.updated"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}

export const serviceDeletedSchema = z.object({ serviceId: z.string().uuid() });
export type ServiceDeletedEvent = z.infer<typeof serviceDeletedSchema>;
export function emitServiceDeleted(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ServiceDeletedEvent,
) {
   return emit({
      ...ctx,
      eventName: SERVICE_EVENTS["service.deleted"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}

export const serviceMeterCreatedSchema = z.object({
   meterId: z.string().uuid(),
   eventName: z.string(),
});
export type ServiceMeterCreatedEvent = z.infer<
   typeof serviceMeterCreatedSchema
>;
export function emitServiceMeterCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ServiceMeterCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: SERVICE_EVENTS["service.meter_created"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}

export const serviceBenefitCreatedSchema = z.object({
   benefitId: z.string().uuid(),
   name: z.string(),
});
export type ServiceBenefitCreatedEvent = z.infer<
   typeof serviceBenefitCreatedSchema
>;
export function emitServiceBenefitCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ServiceBenefitCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: SERVICE_EVENTS["service.benefit_created"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}

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
      eventName: SERVICE_EVENTS["subscription.created"],
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
      eventName: SERVICE_EVENTS["usage.ingested"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}
