import type { Money } from "@f-o-t/money";
import { toMajorUnitsString } from "@f-o-t/money";
import type { DatabaseInstance } from "@core/database/client";
import {
   createWebhookDelivery,
   findMatchingWebhooks,
} from "@core/database/repositories/webhook-repository";
import { events } from "@core/database/schemas/events";
import { getLogger } from "@core/logging/root";
import type { PostHog } from "@core/posthog/server";
import type { WebhookDeliveryJobData } from "./queues/webhook-delivery";
import type { StripeClient } from "@core/stripe";
import { STRIPE_METER_EVENTS } from "@core/stripe/constants";
import type { Redis } from "@core/redis/connection";
import type { EmitFn, EventCategory } from "./catalog";

const logger = getLogger().child({ module: "events" });

import { incrementUsage, isWithinFreeTier } from "./credits";
import { getEventPrice } from "./utils";

export interface EmitEventParams {
   db: DatabaseInstance;
   redis?: Redis;
   posthog?: PostHog;
   organizationId: string;
   eventName: string;
   eventCategory: EventCategory;
   properties: Record<string, unknown>;
   userId?: string;
   teamId?: string;
   ipAddress?: string;
   userAgent?: string;
   priceOverride?: Money;
   stripeClient?: StripeClient;
   stripeCustomerId?: string;
}

export function createEmitFn(
   db: DatabaseInstance,
   posthog?: PostHog,
   stripeClient?: StripeClient,
   stripeCustomerId?: string,
   redis?: Redis,
): EmitFn {
   return (params) =>
      emitEvent({
         ...params,
         db,
         posthog,
         stripeClient,
         stripeCustomerId,
         redis,
      });
}

export interface EmitEventBatchParams {
   db: DatabaseInstance;
   posthog?: PostHog;
   events: Omit<EmitEventParams, "db" | "posthog" | "redis">[];
}

let webhookDeliveryHandler:
   | ((data: WebhookDeliveryJobData) => Promise<void>)
   | null = null;

export function setWebhookDeliveryHandler(
   fn: (data: WebhookDeliveryJobData) => Promise<void>,
): void {
   webhookDeliveryHandler = fn;
}

function buildWebhookPayload(
   eventId: string,
   eventName: string,
   organizationId: string,
   properties: Record<string, unknown>,
): Record<string, unknown> {
   return {
      id: eventId,
      event: eventName,
      data: properties,
      created_at: new Date().toISOString(),
      organization_id: organizationId,
   };
}

export async function emitEvent(params: EmitEventParams): Promise<void> {
   const {
      db,
      redis,
      posthog,
      organizationId,
      eventName,
      eventCategory,
      properties,
      userId,
      teamId,
      ipAddress,
      userAgent,
   } = params;

   try {
      const { price, isBillable } = params.priceOverride
         ? { price: params.priceOverride, isBillable: true }
         : await getEventPrice(db, eventName);

      const [storedEvent] = await db
         .insert(events)
         .values({
            organizationId,
            eventName,
            eventCategory,
            properties,
            userId: userId ?? null,
            teamId: teamId ?? null,
            isBillable,
            pricePerEvent: toMajorUnitsString(price),
            ipAddress,
            userAgent,
         })
         .returning();

      if (isBillable) {
         await incrementUsage(organizationId, eventName, redis);
         const withinFree = await isWithinFreeTier(
            organizationId,
            eventName,
            redis,
         );
         const meterEventName = STRIPE_METER_EVENTS[eventName];
         if (
            !withinFree &&
            meterEventName &&
            params.stripeClient &&
            params.stripeCustomerId
         ) {
            try {
               await params.stripeClient.billing.meterEvents.create({
                  event_name: meterEventName,
                  payload: {
                     stripe_customer_id: params.stripeCustomerId,
                     value: "1",
                  },
                  timestamp: Math.floor(Date.now() / 1000),
               });
            } catch (stripeErr) {
               logger.error(
                  { err: stripeErr, meterEventName },
                  "Failed to send meter event to Stripe",
               );
            }
         }
      }

      if (posthog) {
         posthog.capture({
            distinctId: userId || organizationId,
            event: eventName,
            properties: {
               ...properties,
               $groups: { organization: organizationId },
            },
            groups: { organization: organizationId },
         });
      }

      if (webhookDeliveryHandler && storedEvent) {
         try {
            const matchingWebhooks = await findMatchingWebhooks(
               db,
               organizationId,
               eventName,
               teamId,
            );

            for (const webhook of matchingWebhooks) {
               const payload = buildWebhookPayload(
                  storedEvent.id,
                  eventName,
                  organizationId,
                  properties,
               );

               const delivery = await createWebhookDelivery(db, {
                  webhookEndpointId: webhook.id,
                  eventId: storedEvent.id,
                  url: webhook.url,
                  eventName,
                  payload,
                  status: "pending",
                  attemptNumber: 1,
                  maxAttempts: 5,
               });

               if (!delivery) continue;

               const jobData: WebhookDeliveryJobData = {
                  deliveryId: delivery.id,
                  webhookEndpointId: webhook.id,
                  eventId: storedEvent.id,
                  url: webhook.url,
                  payload,
                  signingSecret: webhook.signingSecret,
                  attemptNumber: 1,
               };

               await webhookDeliveryHandler(jobData);
            }
         } catch (error) {
            logger.error({ err: error }, "Failed to trigger webhooks");
         }
      }
   } catch (error) {
      logger.error({ err: error, eventName }, "Failed to emit event");
   }
}

export async function emitEventBatch(
   params: EmitEventBatchParams,
): Promise<void> {
   const { db, posthog, events: eventList } = params;

   if (eventList.length === 0) return;

   try {
      const uniqueNames = [...new Set(eventList.map((e) => e.eventName))];
      const billingMap = new Map<
         string,
         { priceStr: string; isBillable: boolean }
      >();

      await Promise.all(
         uniqueNames.map(async (name) => {
            const { price, isBillable } = await getEventPrice(db, name);
            billingMap.set(name, {
               priceStr: toMajorUnitsString(price),
               isBillable,
            });
         }),
      );

      const rows = eventList.map((evt) => {
         const billing = billingMap.get(evt.eventName) ?? {
            priceStr: "0",
            isBillable: false,
         };
         return {
            organizationId: evt.organizationId,
            eventName: evt.eventName,
            eventCategory: evt.eventCategory,
            properties: evt.properties,
            userId: evt.userId ?? null,
            teamId: evt.teamId ?? null,
            isBillable: billing.isBillable,
            pricePerEvent: billing.priceStr,
            ipAddress: evt.ipAddress,
            userAgent: evt.userAgent,
         };
      });

      await db.insert(events).values(rows);

      if (posthog) {
         for (const evt of eventList) {
            posthog.capture({
               distinctId: evt.userId || evt.organizationId,
               event: evt.eventName,
               properties: {
                  ...evt.properties,
                  $groups: { organization: evt.organizationId },
               },
               groups: { organization: evt.organizationId },
            });
         }
      }
   } catch (error) {
      logger.error(
         { err: error, batchSize: eventList.length },
         "Failed to emit event batch",
      );
   }
}
