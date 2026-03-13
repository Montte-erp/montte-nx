import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const WEBHOOK_EVENTS: {
   readonly "webhook.endpoint.created": "webhook.endpoint.created";
   readonly "webhook.endpoint.updated": "webhook.endpoint.updated";
   readonly "webhook.endpoint.deleted": "webhook.endpoint.deleted";
   readonly "webhook.delivered": "webhook.delivered";
};
export type WebhookEventName =
   (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];
export declare const WEBHOOK_PRICING: Record<string, string>;
export declare const webhookEndpointCreatedEventSchema: z.ZodObject<
   {
      endpointId: z.ZodString;
      url: z.ZodString;
   },
   z.core.$strip
>;
export type WebhookEndpointCreatedEvent = z.infer<
   typeof webhookEndpointCreatedEventSchema
>;
export declare function emitWebhookEndpointCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: WebhookEndpointCreatedEvent,
): Promise<void>;
export declare const webhookEndpointUpdatedEventSchema: z.ZodObject<
   {
      endpointId: z.ZodString;
      changedFields: z.ZodArray<z.ZodString>;
   },
   z.core.$strip
>;
export type WebhookEndpointUpdatedEvent = z.infer<
   typeof webhookEndpointUpdatedEventSchema
>;
export declare function emitWebhookEndpointUpdated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: WebhookEndpointUpdatedEvent,
): Promise<void>;
export declare const webhookEndpointDeletedEventSchema: z.ZodObject<
   {
      endpointId: z.ZodString;
   },
   z.core.$strip
>;
export type WebhookEndpointDeletedEvent = z.infer<
   typeof webhookEndpointDeletedEventSchema
>;
export declare function emitWebhookEndpointDeleted(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: WebhookEndpointDeletedEvent,
): Promise<void>;
export declare const webhookDeliveredEventSchema: z.ZodObject<
   {
      endpointId: z.ZodString;
      eventName: z.ZodString;
      statusCode: z.ZodNumber;
   },
   z.core.$strip
>;
export type WebhookDeliveredEvent = z.infer<typeof webhookDeliveredEventSchema>;
export declare function emitWebhookDelivered(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: WebhookDeliveredEvent,
): Promise<void>;
//# sourceMappingURL=webhook.d.ts.map
