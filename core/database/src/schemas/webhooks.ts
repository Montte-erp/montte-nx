import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   jsonb,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { platformSchema } from "@core/database/schemas/platform-schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organization, team } from "@core/database/schemas/auth";
import { events } from "@core/database/schemas/events";

export const webhookEndpoints = platformSchema.table(
   "webhook_endpoints",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      url: text("url").notNull(),
      description: text("description"),
      eventPatterns: jsonb("event_patterns").$type<string[]>().notNull(),
      signingSecret: text("signing_secret").notNull(),
      apiKeyId: text("api_key_id"),
      isActive: boolean("is_active").default(true).notNull(),
      failureCount: integer("failure_count").default(0).notNull(),
      lastSuccessAt: timestamp("last_success_at"),
      lastFailureAt: timestamp("last_failure_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      index("webhook_endpoints_org_idx").on(table.organizationId),
      index("webhook_endpoints_team_idx").on(table.teamId),
      index("webhook_endpoints_api_key_idx").on(table.apiKeyId),
      index("webhook_endpoints_active_idx").on(table.isActive),
   ],
);

export const webhookDeliveries = platformSchema.table(
   "webhook_deliveries",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      webhookEndpointId: uuid("webhook_endpoint_id")
         .notNull()
         .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
      eventId: uuid("event_id")
         .notNull()
         .references(() => events.id, { onDelete: "cascade" }),
      url: text("url").notNull(),
      eventName: text("event_name").notNull(),
      payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
      status: text("status").notNull(),
      httpStatusCode: integer("http_status_code"),
      responseBody: text("response_body"),
      errorMessage: text("error_message"),
      attemptNumber: integer("attempt_number").default(1).notNull(),
      maxAttempts: integer("max_attempts").default(5).notNull(),
      nextRetryAt: timestamp("next_retry_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      deliveredAt: timestamp("delivered_at"),
   },
   (table) => [
      index("webhook_deliveries_webhook_idx").on(table.webhookEndpointId),
      index("webhook_deliveries_status_idx").on(table.status),
      index("webhook_deliveries_event_idx").on(table.eventId),
   ],
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;

const baseWebhookEndpointSchema = createInsertSchema(webhookEndpoints).pick({
   url: true,
   description: true,
   eventPatterns: true,
   isActive: true,
});

export const createWebhookEndpointSchema = baseWebhookEndpointSchema.extend({
   url: z.string().url("URL inválida."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   eventPatterns: z
      .array(z.string().min(1, "Padrão de evento não pode ser vazio."))
      .min(1, "Pelo menos um padrão de evento é obrigatório."),
   isActive: z.boolean().default(true),
});

export const updateWebhookEndpointSchema =
   createWebhookEndpointSchema.partial();

export type CreateWebhookEndpointInput = z.infer<
   typeof createWebhookEndpointSchema
>;
export type UpdateWebhookEndpointInput = z.infer<
   typeof updateWebhookEndpointSchema
>;
