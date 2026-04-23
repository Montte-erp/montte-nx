import { sql } from "drizzle-orm";
import {
   index,
   jsonb,
   numeric,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { platformSchema } from "@core/database/schemas/schemas";
import { team } from "@core/database/schemas/auth";
import { contacts } from "@core/database/schemas/contacts";

export const usageEvents = platformSchema.table(
   "usage_events",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      contactId: uuid("contact_id").references(() => contacts.id, {
         onDelete: "set null",
      }),
      meterId: text("meter_id").notNull(),
      quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
      properties: jsonb("properties")
         .$type<Record<string, unknown>>()
         .notNull()
         .default(sql`'{}'::jsonb`),
      idempotencyKey: text("idempotency_key").notNull(),
      timestamp: timestamp("timestamp").defaultNow().notNull(),
   },
   (table) => [
      uniqueIndex("usage_events_team_idempotency_key_idx").on(
         table.teamId,
         table.idempotencyKey,
      ),
      index("usage_events_team_id_idx").on(table.teamId),
      index("usage_events_contact_id_idx").on(table.contactId),
      index("usage_events_meter_id_idx").on(table.meterId),
      index("usage_events_timestamp_idx").on(table.timestamp),
   ],
);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;

export const upsertUsageEventSchema = createInsertSchema(usageEvents)
   .pick({
      teamId: true,
      contactId: true,
      meterId: true,
      quantity: true,
      properties: true,
      idempotencyKey: true,
   })
   .extend({
      teamId: z.string().uuid("ID do time inválido."),
      contactId: z
         .string()
         .uuid("ID do contato inválido.")
         .nullable()
         .optional(),
      meterId: z.string().min(1, "ID do medidor é obrigatório."),
      quantity: z
         .string()
         .min(1, "Quantidade é obrigatória.")
         .refine((v) => {
            const n = Number(v);
            return !Number.isNaN(n) && Number.isFinite(n) && n >= 0;
         }, "Quantidade deve ser um número positivo finito."),
      properties: z.record(z.string(), z.unknown()).optional().default({}),
      idempotencyKey: z.string().min(1, "Chave de idempotência é obrigatória."),
   });

export type UpsertUsageEventInput = z.infer<typeof upsertUsageEventSchema>;
