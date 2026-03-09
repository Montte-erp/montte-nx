import { createHmac } from "node:crypto";
import type { DatabaseInstance } from "@core/database/client";
import {
   incrementWebhookFailureCount,
   updateWebhookDeliveryStatus,
   updateWebhookLastSuccess,
} from "@core/database/repositories/webhook-repository";
import { getLogger } from "@core/logging/root";
import type { WebhookDeliveryJobData } from "@packages/queue/webhook-delivery";

const logger = getLogger().child({ module: "job:webhook" });

function generateSignature(
   payload: string,
   secret: string,
   timestamp: number,
): string {
   const signaturePayload = `${timestamp}.${payload}`;
   return createHmac("sha256", secret).update(signaturePayload).digest("hex");
}

export async function deliverWebhook(
   db: DatabaseInstance,
   job: WebhookDeliveryJobData,
): Promise<void> {
   const {
      deliveryId,
      webhookEndpointId,
      url,
      payload,
      signingSecret,
      attemptNumber,
   } = job;

   const timestamp = Date.now();
   const payloadString = JSON.stringify(payload);
   const signature = generateSignature(payloadString, signingSecret, timestamp);

   try {
      const response = await fetch(url, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
            "X-Montte-Signature": `t=${timestamp},v1=${signature}`,
            "X-Montte-Event": String(payload.event ?? ""),
            "X-Montte-Delivery-Id": deliveryId,
            "X-Montte-Attempt": attemptNumber.toString(),
            "User-Agent": "Montte-Webhooks/1.0",
         },
         body: payloadString,
         signal: AbortSignal.timeout(30_000),
      });

      const responseBody = await response.text().catch(() => "");

      if (response.ok) {
         await updateWebhookDeliveryStatus(db, deliveryId, {
            status: "success",
            httpStatusCode: response.status,
            responseBody: responseBody.slice(0, 1000),
            deliveredAt: new Date(),
         });

         await updateWebhookLastSuccess(db, webhookEndpointId);
         logger.info({ url, attemptNumber }, "Webhook delivered");
      } else {
         throw new Error(
            `HTTP ${response.status}: ${responseBody.slice(0, 500)}`,
         );
      }
   } catch (error) {
      const errorMessage =
         error instanceof Error ? error.message : "Unknown error";

      // Update delivery status — BullMQ handles retry scheduling
      await updateWebhookDeliveryStatus(db, deliveryId, {
         status: "retrying",
         errorMessage,
         attemptNumber,
      }).catch((e) =>
         logger.error({ err: e }, "Failed to update delivery status"),
      );

      // If this was the last attempt, mark as failed
      if (attemptNumber >= 5) {
         await updateWebhookDeliveryStatus(db, deliveryId, {
            status: "failed",
            errorMessage: `Max attempts reached: ${errorMessage}`,
         }).catch((e) =>
            logger.error({ err: e }, "Failed to mark delivery as failed"),
         );

         await incrementWebhookFailureCount(db, webhookEndpointId).catch((e) =>
            logger.error({ err: e }, "Failed to increment failure count"),
         );
      }

      // Re-throw so BullMQ retries
      throw error;
   }
}
