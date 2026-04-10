import { AppError, propagateError } from "@core/logging/errors";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateWebhookEndpointInput,
   type NewWebhookDelivery,
   type UpdateWebhookEndpointInput,
   createWebhookEndpointSchema,
   updateWebhookEndpointSchema,
   webhookDeliveries,
   webhookEndpoints,
} from "../schemas/webhooks";

export function generateWebhookSecret(): string {
   const bytes = crypto.getRandomValues(new Uint8Array(32));
   return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureWebhookOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const endpoint = await getWebhookEndpoint(db, id);
   if (!endpoint || endpoint.teamId !== teamId) {
      throw AppError.notFound("Webhook não encontrado.");
   }
   return endpoint;
}

export async function createWebhookEndpoint(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   data: CreateWebhookEndpointInput,
) {
   try {
      const validated = createWebhookEndpointSchema.parse(data);
      const [endpoint] = await db
         .insert(webhookEndpoints)
         .values({
            ...validated,
            organizationId,
            teamId,
            signingSecret: generateWebhookSecret(),
         })
         .returning();
      if (!endpoint)
         throw AppError.database("Failed to create webhook endpoint");
      return endpoint;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create webhook endpoint");
   }
}

export async function listWebhookEndpoints(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      return await db
         .select()
         .from(webhookEndpoints)
         .where(eq(webhookEndpoints.teamId, teamId))
         .orderBy(desc(webhookEndpoints.createdAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list webhook endpoints");
   }
}

export async function getWebhookEndpoint(
   db: DatabaseInstance,
   webhookId: string,
) {
   try {
      const [endpoint] = await db
         .select()
         .from(webhookEndpoints)
         .where(eq(webhookEndpoints.id, webhookId))
         .limit(1);

      return endpoint ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get webhook endpoint");
   }
}

export async function updateWebhookEndpoint(
   db: DatabaseInstance,
   webhookId: string,
   data: UpdateWebhookEndpointInput,
) {
   try {
      const validated = updateWebhookEndpointSchema.parse(data);
      const [updated] = await db
         .update(webhookEndpoints)
         .set(validated)
         .where(eq(webhookEndpoints.id, webhookId))
         .returning();

      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update webhook endpoint");
   }
}

export async function deleteWebhookEndpoint(
   db: DatabaseInstance,
   webhookId: string,
) {
   try {
      await db
         .delete(webhookEndpoints)
         .where(eq(webhookEndpoints.id, webhookId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete webhook endpoint");
   }
}

export async function updateWebhookLastSuccess(
   db: DatabaseInstance,
   webhookId: string,
) {
   try {
      await db
         .update(webhookEndpoints)
         .set({
            lastSuccessAt: new Date(),
            failureCount: 0,
         })
         .where(eq(webhookEndpoints.id, webhookId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update webhook success");
   }
}

export async function incrementWebhookFailureCount(
   db: DatabaseInstance,
   webhookId: string,
) {
   try {
      await db
         .update(webhookEndpoints)
         .set({
            failureCount: sql`${webhookEndpoints.failureCount} + 1`,
            lastFailureAt: new Date(),
         })
         .where(eq(webhookEndpoints.id, webhookId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to increment failure count");
   }
}

export async function findMatchingWebhooks(
   db: DatabaseInstance,
   organizationId: string,
   eventName: string,
   teamId?: string,
) {
   try {
      const endpoints = await db
         .select()
         .from(webhookEndpoints)
         .where(
            and(
               eq(webhookEndpoints.organizationId, organizationId),
               eq(webhookEndpoints.isActive, true),
               ...(teamId ? [eq(webhookEndpoints.teamId, teamId)] : []),
            ),
         );

      return endpoints.filter((endpoint) =>
         endpoint.eventPatterns.some((pattern) =>
            matchesPattern(eventName, pattern),
         ),
      );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to find matching webhooks");
   }
}

function matchesPattern(eventName: string, pattern: string): boolean {
   if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return eventName.startsWith(`${prefix}.`);
   }
   return eventName === pattern;
}

export async function createWebhookDelivery(
   db: DatabaseInstance,
   data: NewWebhookDelivery,
) {
   try {
      const [delivery] = await db
         .insert(webhookDeliveries)
         .values(data)
         .returning();

      return delivery;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create webhook delivery");
   }
}

export async function updateWebhookDeliveryStatus(
   db: DatabaseInstance,
   deliveryId: string,
   data: {
      status: string;
      httpStatusCode?: number;
      responseBody?: string;
      errorMessage?: string;
      attemptNumber?: number;
      nextRetryAt?: Date;
      deliveredAt?: Date;
   },
) {
   try {
      const [updated] = await db
         .update(webhookDeliveries)
         .set(data)
         .where(eq(webhookDeliveries.id, deliveryId))
         .returning();

      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update webhook delivery");
   }
}

export async function getPendingWebhookDeliveries(db: DatabaseInstance) {
   try {
      return await db
         .select({
            deliveryId: webhookDeliveries.id,
            webhookEndpointId: webhookDeliveries.webhookEndpointId,
            eventId: webhookDeliveries.eventId,
            url: webhookDeliveries.url,
            eventName: webhookDeliveries.eventName,
            payload: webhookDeliveries.payload,
            attemptNumber: webhookDeliveries.attemptNumber,
            signingSecret: webhookEndpoints.signingSecret,
         })
         .from(webhookDeliveries)
         .innerJoin(
            webhookEndpoints,
            eq(webhookDeliveries.webhookEndpointId, webhookEndpoints.id),
         )
         .where(
            and(
               inArray(webhookDeliveries.status, ["pending", "retrying"]),
               or(
                  isNull(webhookDeliveries.nextRetryAt),
                  lte(webhookDeliveries.nextRetryAt, new Date()),
               ),
            ),
         )
         .limit(100);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get pending webhook deliveries");
   }
}

export async function getWebhookDeliveries(
   db: DatabaseInstance,
   webhookId: string,
   options: { offset?: number; limit?: number } = {},
) {
   try {
      const { offset = 0, limit = 50 } = options;

      return await db
         .select()
         .from(webhookDeliveries)
         .where(eq(webhookDeliveries.webhookEndpointId, webhookId))
         .orderBy(desc(webhookDeliveries.createdAt))
         .offset(offset)
         .limit(limit);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get webhook deliveries");
   }
}
