import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   numeric,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { categories } from "@core/database/schemas/categories";
import { billingCycleEnum } from "@core/database/schemas/subscriptions";
import { meters } from "@core/database/schemas/meters";
import { tags } from "@core/database/schemas/tags";
import { crmSchema } from "@core/database/schemas/schemas";

export const pricingTypeEnum = crmSchema.enum("pricing_type", [
   "flat",
   "per_unit",
   "metered",
]);

export type PricingType = (typeof pricingTypeEnum.enumValues)[number];

export const services = crmSchema.table(
   "services",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "set null",
      }),
      tagId: uuid("tag_id").references(() => tags.id, { onDelete: "set null" }),
      costPrice: numeric("cost_price", { precision: 12, scale: 4 })
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
   (table) => [index("services_team_id_idx").on(table.teamId)],
);

export const servicePrices = crmSchema.table(
   "service_prices",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: pricingTypeEnum("type").notNull().default("flat"),
      basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
      interval: billingCycleEnum("interval").notNull(),
      meterId: uuid("meter_id").references(() => meters.id, {
         onDelete: "set null",
      }),
      minPrice: numeric("min_price", { precision: 12, scale: 2 }),
      priceCap: numeric("price_cap", { precision: 12, scale: 2 }),
      trialDays: integer("trial_days"),
      autoEnroll: boolean("auto_enroll").notNull().default(false),
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
      index("service_prices_service_id_idx").on(table.serviceId),
      index("service_prices_team_id_idx").on(table.teamId),
      index("service_prices_meter_id_idx").on(table.meterId),
   ],
);

export const resources = crmSchema.table(
   "resources",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      capacity: integer("capacity").notNull().default(1),
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
      index("resources_team_id_idx").on(table.teamId),
      index("resources_service_id_idx").on(table.serviceId),
   ],
);

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type ServicePrice = typeof servicePrices.$inferSelect;
export type NewServicePrice = typeof servicePrices.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Preço deve ser um número válido maior ou igual a zero.",
   });

const baseServiceSchema = createInsertSchema(services).pick({
   name: true,
   description: true,
   categoryId: true,
   tagId: true,
   costPrice: true,
});

export const createServiceSchema = baseServiceSchema.extend({
   name: nameSchema,
   description: z.string().max(500).nullable().optional(),
   categoryId: z.string().uuid().nullable().optional(),
   tagId: z.string().uuid().nullable().optional(),
   costPrice: priceSchema.default("0"),
});

export const updateServiceSchema = baseServiceSchema
   .extend({
      name: nameSchema.optional(),
      description: z.string().max(500).nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      tagId: z.string().uuid().nullable().optional(),
      costPrice: priceSchema.optional(),
      isActive: z.boolean().optional(),
   })
   .partial();

const basePriceSchema = createInsertSchema(servicePrices).pick({
   name: true,
   type: true,
   basePrice: true,
   interval: true,
   meterId: true,
   priceCap: true,
   minPrice: true,
   trialDays: true,
   autoEnroll: true,
});

export const createPriceSchema = basePriceSchema.extend({
   name: nameSchema,
   type: z.enum(pricingTypeEnum.enumValues).default("flat"),
   basePrice: priceSchema,
   interval: z.enum(billingCycleEnum.enumValues),
   meterId: z.string().uuid().nullable().optional(),
   priceCap: priceSchema.nullable().optional(),
   minPrice: priceSchema.nullable().optional(),
   trialDays: z.number().int().min(0).nullable().optional(),
   autoEnroll: z.boolean().default(false),
});

export const updatePriceSchema = basePriceSchema
   .extend({
      name: nameSchema.optional(),
      basePrice: priceSchema.optional(),
      interval: z.enum(billingCycleEnum.enumValues).optional(),
      isActive: z.boolean().optional(),
      priceCap: priceSchema.nullable().optional(),
      minPrice: priceSchema.nullable().optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
   })
   .partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreatePriceInput = z.infer<typeof createPriceSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;

export const serviceSchema = createSelectSchema(services);
export const servicePriceSchema = createSelectSchema(servicePrices);
