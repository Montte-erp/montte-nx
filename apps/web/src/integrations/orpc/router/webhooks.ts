import { ORPCError } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
import { listEventCatalog } from "@core/database/repositories/event-catalog-repository";
import {
   createWebhookEndpoint,
   deleteWebhookEndpoint,
   ensureWebhookOwnership,
   getWebhookDeliveries,
   listWebhookEndpoints,
   updateWebhookEndpoint,
} from "@core/database/repositories/webhook-repository";
import { createEmitFn } from "@packages/events/emit";
import {
   emitWebhookEndpointCreated,
   emitWebhookEndpointDeleted,
   emitWebhookEndpointUpdated,
} from "@packages/events/webhook";
import { z } from "zod";
import { protectedProcedure } from "../server";

const createWebhookSchema = z.object({
   url: z.string().url(),
   description: z.string().optional(),
   eventPatterns: z.array(z.string()).min(1),
});

const updateWebhookSchema = z.object({
   id: z.string().uuid(),
   url: z.string().url().optional(),
   description: z.string().optional(),
   eventPatterns: z.array(z.string()).min(1).optional(),
   isActive: z.boolean().optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

async function validateEventPatterns(
   eventPatterns: string[],
   db: Parameters<typeof listEventCatalog>[0],
) {
   if (eventPatterns.some((pattern) => pattern.includes("*"))) {
      throw WebAppError.badRequest("Padrões com wildcard não são permitidos.");
   }

   const catalogEntries = await listEventCatalog(db);
   const allowedEvents = new Set(
      catalogEntries.filter((event) => event.isActive).map((e) => e.eventName),
   );
   const unknownEvents = eventPatterns.filter(
      (pattern) => !allowedEvents.has(pattern),
   );

   if (unknownEvents.length > 0) {
      throw WebAppError.badRequest(
         `Eventos inválidos: ${unknownEvents.join(", ")}`,
      );
   }
}

export const create = protectedProcedure
   .input(createWebhookSchema)
   .handler(async ({ context, input }) => {
      const { auth, headers, organizationId, db, posthog, userId, teamId } =
         context;

      await validateEventPatterns(input.eventPatterns, db);

      let apiKey: { id: string; key: string };
      try {
         apiKey = await auth.api.createApiKey({
            headers,
            body: {
               prefix: "cta_wh",
               name: `Webhook (${input.url})`,
               userId,
               metadata: {
                  type: "webhook",
                  organizationId,
                  teamId,
                  url: input.url,
               },
            },
         });
      } catch (error) {
         if (error instanceof ORPCError) throw error;
         throw WebAppError.internal("Falha ao criar chave de API do webhook.");
      }

      const endpoint = await createWebhookEndpoint(db, organizationId, teamId, {
         url: input.url,
         description: input.description,
         eventPatterns: input.eventPatterns,
         isActive: true,
      });

      try {
         await emitWebhookEndpointCreated(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { endpointId: endpoint.id, url: input.url },
         );
      } catch {}

      return {
         endpoint: {
            ...endpoint,
            signingSecret: `${endpoint.signingSecret.slice(0, 8)}...`,
         },
         plaintextSecret: apiKey.key,
      };
   });

export const list = protectedProcedure.handler(async ({ context }) => {
   const endpoints = await listWebhookEndpoints(context.db, context.teamId);

   return endpoints.map((e) => ({
      ...e,
      signingSecret: `${e.signingSecret.slice(0, 8)}...`,
   }));
});

export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const endpoint = await ensureWebhookOwnership(
         context.db,
         input.id,
         context.teamId,
      );

      return {
         ...endpoint,
         signingSecret: `${endpoint.signingSecret.slice(0, 8)}...`,
      };
   });

export const update = protectedProcedure
   .input(updateWebhookSchema)
   .handler(async ({ context, input }) => {
      const { db, posthog, userId, teamId } = context;

      const endpoint = await ensureWebhookOwnership(db, input.id, teamId);

      if (input.eventPatterns) {
         await validateEventPatterns(input.eventPatterns, db);
      }

      const { id, ...updateData } = input;
      const updated = await updateWebhookEndpoint(db, id, updateData);

      try {
         const changedFields = Object.keys(updateData).filter(
            (k) => updateData[k as keyof typeof updateData] !== undefined,
         );
         await emitWebhookEndpointUpdated(
            createEmitFn(db, posthog),
            {
               organizationId: endpoint.organizationId,
               userId,
               teamId,
            },
            { endpointId: id, changedFields },
         );
      } catch {}

      return updated;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const { auth, headers, db, posthog, userId, teamId } = context;

      const endpoint = await ensureWebhookOwnership(db, input.id, teamId);

      if (endpoint.apiKeyId) {
         try {
            await auth.api.deleteApiKey({
               headers,
               body: { keyId: endpoint.apiKeyId },
            });
         } catch (error) {
            if (error instanceof ORPCError) throw error;
            throw WebAppError.internal(
               "Falha ao remover chave de API do webhook.",
            );
         }
      }

      await deleteWebhookEndpoint(db, input.id);

      try {
         await emitWebhookEndpointDeleted(
            createEmitFn(db, posthog),
            {
               organizationId: endpoint.organizationId,
               userId,
               teamId,
            },
            { endpointId: input.id },
         );
      } catch {}

      return { success: true };
   });

export const getEventCatalog = protectedProcedure.handler(
   async ({ context }) => {
      return listEventCatalog(context.db);
   },
);

export const deliveries = protectedProcedure
   .input(
      z.object({
         webhookId: z.string().uuid(),
         page: z.number().min(1).optional().default(1),
         limit: z.number().min(1).max(100).optional().default(50),
      }),
   )
   .handler(async ({ context, input }) => {
      await ensureWebhookOwnership(context.db, input.webhookId, context.teamId);

      const items = await getWebhookDeliveries(context.db, input.webhookId, {
         offset: (input.page - 1) * input.limit,
         limit: input.limit,
      });

      return { items, page: input.page, limit: input.limit };
   });
