import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const CONTACT_EVENTS = {
   "contact.created": "contact.created",
   "contact.updated": "contact.updated",
   "contact.deleted": "contact.deleted",
} as const;

export type ContactEventName =
   (typeof CONTACT_EVENTS)[keyof typeof CONTACT_EVENTS];

export const contactCreatedSchema = z.object({
   contactId: z.string().uuid(),
   type: z.enum(["person", "company"]),
});
export type ContactCreatedEvent = z.infer<typeof contactCreatedSchema>;

export function emitContactCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ContactCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: CONTACT_EVENTS["contact.created"],
      eventCategory: EVENT_CATEGORIES.contact,
      properties,
   });
}

export const contactUpdatedSchema = z.object({
   contactId: z.string().uuid(),
   changedFields: z.array(z.string()),
});
export type ContactUpdatedEvent = z.infer<typeof contactUpdatedSchema>;
export function emitContactUpdated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ContactUpdatedEvent,
) {
   return emit({
      ...ctx,
      eventName: CONTACT_EVENTS["contact.updated"],
      eventCategory: EVENT_CATEGORIES.contact,
      properties,
   });
}

export const contactDeletedSchema = z.object({ contactId: z.string().uuid() });
export type ContactDeletedEvent = z.infer<typeof contactDeletedSchema>;
export function emitContactDeleted(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ContactDeletedEvent,
) {
   return emit({
      ...ctx,
      eventName: CONTACT_EVENTS["contact.deleted"],
      eventCategory: EVENT_CATEGORIES.contact,
      properties,
   });
}
