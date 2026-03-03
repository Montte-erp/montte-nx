import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const SERVICE_EVENTS = {
   "service.created": "service.created",
   "service.updated": "service.updated",
   "service.deleted": "service.deleted",
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
