import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const SERVICE_EVENTS: {
   readonly "service.created": "service.created";
   readonly "service.updated": "service.updated";
   readonly "service.deleted": "service.deleted";
};
export type ServiceEventName =
   (typeof SERVICE_EVENTS)[keyof typeof SERVICE_EVENTS];
export declare const serviceCreatedSchema: z.ZodObject<
   {
      serviceId: z.ZodString;
      name: z.ZodString;
   },
   z.core.$strip
>;
export type ServiceCreatedEvent = z.infer<typeof serviceCreatedSchema>;
export declare function emitServiceCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: ServiceCreatedEvent,
): Promise<void>;
export declare const serviceUpdatedSchema: z.ZodObject<
   {
      serviceId: z.ZodString;
      changedFields: z.ZodArray<z.ZodString>;
   },
   z.core.$strip
>;
export type ServiceUpdatedEvent = z.infer<typeof serviceUpdatedSchema>;
export declare function emitServiceUpdated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: ServiceUpdatedEvent,
): Promise<void>;
export declare const serviceDeletedSchema: z.ZodObject<
   {
      serviceId: z.ZodString;
   },
   z.core.$strip
>;
export type ServiceDeletedEvent = z.infer<typeof serviceDeletedSchema>;
export declare function emitServiceDeleted(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: ServiceDeletedEvent,
): Promise<void>;
//# sourceMappingURL=service.d.ts.map
