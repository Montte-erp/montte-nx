import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";
export declare const WEBHOOK_DELIVERY_QUEUE = "webhook-delivery";
export interface WebhookDeliveryJobData {
   deliveryId: string;
   webhookEndpointId: string;
   eventId: string;
   url: string;
   payload: Record<string, unknown>;
   signingSecret: string;
   attemptNumber: number;
}
export declare function createWebhookDeliveryQueue(
   connection: ConnectionOptions,
): Queue<WebhookDeliveryJobData>;
//# sourceMappingURL=webhook-delivery.d.ts.map
