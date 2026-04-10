export interface WebhookDeliveryJobData {
   deliveryId: string;
   webhookEndpointId: string;
   eventId: string;
   url: string;
   payload: Record<string, unknown>;
   signingSecret: string;
   attemptNumber: number;
}
