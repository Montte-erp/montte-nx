import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "@packages/events/catalog";

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
      eventName: "service.created",
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
      eventName: "service.updated",
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
      eventName: "service.deleted",
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
      eventName: "service.meter_created",
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
      eventName: "service.benefit_created",
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}
