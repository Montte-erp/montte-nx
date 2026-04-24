import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   jsonb,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { crmSchema } from "@core/database/schemas/schemas";
export const meterAggregationEnum = crmSchema.enum("meter_aggregation", [
   "sum",
   "count",
   "count_unique",
   "max",
   "last",
]);
export const meters = crmSchema.table(
   "meters",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      eventName: text("event_name").notNull(),
      aggregation: meterAggregationEnum("aggregation").notNull().default("sum"),
      aggregationProperty: text("aggregation_property"),
      filters: jsonb("filters")
         .$type()
         .notNull()
         .default(sql`'{}'::jsonb`),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      uniqueIndex("meters_team_id_event_name_idx").on(
         table.teamId,
         table.eventName,
      ),
      index("meters_team_id_idx").on(table.teamId),
   ],
);
const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");
const baseSchema = createInsertSchema(meters).pick({
   name: true,
   eventName: true,
   aggregation: true,
   aggregationProperty: true,
   filters: true,
});
export const createMeterSchema = baseSchema.extend({
   name: nameSchema,
   eventName: z.string().min(1, "Nome do evento é obrigatório."),
   aggregation: z.enum(meterAggregationEnum.enumValues).default("sum"),
   aggregationProperty: z.string().nullable().optional(),
   filters: z.record(z.string(), z.unknown()).optional().default({}),
});
export const updateMeterSchema = z.object({
   name: nameSchema.optional(),
   isActive: z.boolean().optional(),
});
