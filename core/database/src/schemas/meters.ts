import { sql } from "drizzle-orm";
import {
   boolean,
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
import { crmSchema } from "@core/database/schemas/schemas";

export const meterAggregationEnum = crmSchema.enum("meter_aggregation", [
   "sum",
   "count",
   "count_unique",
   "max",
   "last",
]);

export type MeterAggregation = (typeof meterAggregationEnum.enumValues)[number];

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
         .$type<Record<string, unknown>>()
         .notNull()
         .default(sql`'{}'::jsonb`),
      unitCost: numeric("unit_cost", { precision: 12, scale: 4 })
         .notNull()
         .default("0"),
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

export type Meter = typeof meters.$inferSelect;
export type NewMeter = typeof meters.$inferInsert;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const unitCostSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message:
         "Custo unitário deve ser um número válido maior ou igual a zero.",
   });

const baseSchema = createInsertSchema(meters).pick({
   name: true,
   eventName: true,
   aggregation: true,
   aggregationProperty: true,
   filters: true,
   unitCost: true,
});

export const createMeterSchema = baseSchema.extend({
   name: nameSchema,
   eventName: z.string().min(1, "Nome do evento é obrigatório."),
   aggregation: z.enum(meterAggregationEnum.enumValues).default("sum"),
   aggregationProperty: z.string().nullable().optional(),
   filters: z.record(z.string(), z.unknown()).optional().default({}),
   unitCost: unitCostSchema.optional().default("0"),
});

export const updateMeterSchema = z.object({
   name: nameSchema.optional(),
   eventName: z.string().min(1).optional(),
   aggregation: z.enum(meterAggregationEnum.enumValues).optional(),
   aggregationProperty: z.string().nullable().optional(),
   unitCost: unitCostSchema.optional(),
   isActive: z.boolean().optional(),
});

export type CreateMeterInput = z.infer<typeof createMeterSchema>;
export type UpdateMeterInput = z.infer<typeof updateMeterSchema>;
