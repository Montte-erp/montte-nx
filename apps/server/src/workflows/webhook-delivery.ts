import { createHmac } from "node:crypto";
import { DBOS } from "@dbos-inc/dbos-sdk";
import {
   getPendingWebhookDeliveries,
   incrementWebhookFailureCount,
   updateWebhookDeliveryStatus,
   updateWebhookLastSuccess,
} from "@core/database/repositories/webhook-repository";
import { getLogger } from "@core/logging/root";
import { db } from "../singletons";

const logger = getLogger().child({ module: "workflow:webhook-delivery" });

function generateSignature(
   payload: string,
   secret: string,
   timestamp: number,
): string {
   const signaturePayload = `${timestamp}.${payload}`;
   return createHmac("sha256", secret).update(signaturePayload).digest("hex");
}

export class WebhookDeliveryWorkflow {
   @DBOS.step()
   static async fetchPendingDeliveries() {
      return getPendingWebhookDeliveries(db);
   }

   @DBOS.step()
   static async deliverOne(delivery: {
      id: string;
      webhookEndpointId: string;
      url: string;
      payload: Record<string, unknown>;
      signingSecret: string;
      attemptNumber: number;
      maxAttempts: number;
   }): Promise<void> {
      const {
         id,
         webhookEndpointId,
         url,
         payload,
         signingSecret,
         attemptNumber,
         maxAttempts,
      } = delivery;
      const timestamp = Date.now();
      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(
         payloadString,
         signingSecret,
         timestamp,
      );

      try {
         const response = await fetch(url, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "X-Montte-Signature": `t=${timestamp},v1=${signature}`,
               "X-Montte-Event": String(payload.event ?? ""),
               "X-Montte-Delivery-Id": id,
               "X-Montte-Attempt": attemptNumber.toString(),
               "User-Agent": "Montte-Webhooks/1.0",
            },
            body: payloadString,
            signal: AbortSignal.timeout(30_000),
         });

         const responseBody = await response.text().catch(() => "");

         if (response.ok) {
            await updateWebhookDeliveryStatus(db, id, {
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
         const nextAttempt = attemptNumber + 1;
         const isLastAttempt = nextAttempt > maxAttempts;

         if (isLastAttempt) {
            await updateWebhookDeliveryStatus(db, id, {
               status: "failed",
               errorMessage: `Max attempts reached: ${errorMessage}`,
            }).catch((e) =>
               logger.error({ err: e }, "Failed to mark delivery as failed"),
            );
            await incrementWebhookFailureCount(db, webhookEndpointId).catch(
               (e) =>
                  logger.error({ err: e }, "Failed to increment failure count"),
            );
         } else {
            const nextRetryAt = new Date(Date.now() + nextAttempt * 60_000);
            await updateWebhookDeliveryStatus(db, id, {
               status: "retrying",
               errorMessage,
               attemptNumber: nextAttempt,
               nextRetryAt,
            }).catch((e) =>
               logger.error({ err: e }, "Failed to update delivery status"),
            );
         }

         logger.error(
            { url, attemptNumber, err: errorMessage },
            "Webhook delivery failed",
         );
      }
   }

   @DBOS.scheduled({ crontab: "* * * * *" })
   @DBOS.workflow()
   static async run(_scheduledTime: Date, _startTime: Date): Promise<void> {
      const deliveries = await WebhookDeliveryWorkflow.fetchPendingDeliveries();
      for (const delivery of deliveries) {
         await WebhookDeliveryWorkflow.deliverOne(delivery);
      }
   }
}
