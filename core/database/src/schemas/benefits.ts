import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   primaryKey,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { meters } from "@core/database/schemas/meters";
import { services } from "@core/database/schemas/services";
import { crmSchema } from "@core/database/schemas/schemas";

export const benefitTypeEnum = crmSchema.enum("benefit_type", [
   "credits",
   "feature_access",
   "custom",
]);
export type BenefitType = (typeof benefitTypeEnum.enumValues)[number];

export const benefits = crmSchema.table(
   "benefits",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: benefitTypeEnum("type").notNull(),
      meterId: uuid("meter_id").references(() => meters.id, {
         onDelete: "set null",
      }),
      creditAmount: integer("credit_amount"),
      description: text("description"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [index("benefits_team_id_idx").on(table.teamId)],
);

export const serviceBenefits = crmSchema.table(
   "service_benefits",
   {
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      benefitId: uuid("benefit_id")
         .notNull()
         .references(() => benefits.id, { onDelete: "cascade" }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [
      primaryKey({ columns: [table.serviceId, table.benefitId] }),
      index("service_benefits_service_id_idx").on(table.serviceId),
   ],
);

export type Benefit = typeof benefits.$inferSelect;
export type NewBenefit = typeof benefits.$inferInsert;
export type ServiceBenefit = typeof serviceBenefits.$inferSelect;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

export const createBenefitSchema = createInsertSchema(benefits)
   .pick({
      name: true,
      type: true,
      meterId: true,
      creditAmount: true,
      description: true,
   })
   .extend({
      name: nameSchema,
      type: z.enum(benefitTypeEnum.enumValues),
      meterId: z.string().uuid().nullable().optional(),
      creditAmount: z.number().int().min(1).nullable().optional(),
      description: z.string().max(500).nullable().optional(),
   });

export const updateBenefitSchema = z.object({
   name: nameSchema.optional(),
   description: z.string().max(500).nullable().optional(),
   isActive: z.boolean().optional(),
});

export type CreateBenefitInput = z.infer<typeof createBenefitSchema>;
export type UpdateBenefitInput = z.infer<typeof updateBenefitSchema>;
