import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   numeric,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { categories } from "@core/database/schemas/categories";
import { billingCycleEnum } from "@core/database/schemas/subscriptions";
import { tags } from "@core/database/schemas/tags";

export const services = pgTable(
   "services",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      basePrice: numeric("base_price", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "set null",
      }),
      tagId: uuid("tag_id").references(() => tags.id, { onDelete: "set null" }),
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

export const serviceVariants = pgTable(
   "service_variants",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
      billingCycle: billingCycleEnum("billing_cycle").notNull(),
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
      index("service_variants_service_id_idx").on(table.serviceId),
      index("service_variants_team_id_idx").on(table.teamId),
   ],
);

export const resources = pgTable(
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
export type ServiceVariant = typeof serviceVariants.$inferSelect;
export type NewServiceVariant = typeof serviceVariants.$inferInsert;
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
   basePrice: true,
   categoryId: true,
   tagId: true,
});

export const createServiceSchema = baseServiceSchema.extend({
   name: nameSchema,
   description: z.string().max(500).nullable().optional(),
   basePrice: priceSchema.default("0"),
   categoryId: z.string().uuid().nullable().optional(),
   tagId: z.string().uuid().nullable().optional(),
});

export const updateServiceSchema = baseServiceSchema
   .extend({
      name: nameSchema.optional(),
      description: z.string().max(500).nullable().optional(),
      basePrice: priceSchema.optional(),
      categoryId: z.string().uuid().nullable().optional(),
      tagId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
   })
   .partial();

const baseVariantSchema = createInsertSchema(serviceVariants).pick({
   name: true,
   basePrice: true,
   billingCycle: true,
});

export const createVariantSchema = baseVariantSchema.extend({
   name: nameSchema,
   basePrice: priceSchema,
   billingCycle: z.enum(["hourly", "monthly", "annual", "one_time"]),
});

export const updateVariantSchema = baseVariantSchema
   .extend({
      name: nameSchema.optional(),
      basePrice: priceSchema.optional(),
      billingCycle: z
         .enum(["hourly", "monthly", "annual", "one_time"])
         .optional(),
      isActive: z.boolean().optional(),
   })
   .partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
