import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const CONTACT_EVENTS: {
   readonly "contact.created": "contact.created";
   readonly "contact.updated": "contact.updated";
   readonly "contact.deleted": "contact.deleted";
};
export type ContactEventName =
   (typeof CONTACT_EVENTS)[keyof typeof CONTACT_EVENTS];
export declare const contactCreatedSchema: z.ZodObject<
   {
      contactId: z.ZodString;
      type: z.ZodEnum<{
         company: "company";
         person: "person";
      }>;
   },
   z.core.$strip
>;
export type ContactCreatedEvent = z.infer<typeof contactCreatedSchema>;
export declare function emitContactCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: ContactCreatedEvent,
): Promise<void>;
export declare const contactUpdatedSchema: z.ZodObject<
   {
      contactId: z.ZodString;
      changedFields: z.ZodArray<z.ZodString>;
   },
   z.core.$strip
>;
export type ContactUpdatedEvent = z.infer<typeof contactUpdatedSchema>;
export declare function emitContactUpdated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: ContactUpdatedEvent,
): Promise<void>;
export declare const contactDeletedSchema: z.ZodObject<
   {
      contactId: z.ZodString;
   },
   z.core.$strip
>;
export type ContactDeletedEvent = z.infer<typeof contactDeletedSchema>;
export declare function emitContactDeleted(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: ContactDeletedEvent,
): Promise<void>;
//# sourceMappingURL=contact.d.ts.map
