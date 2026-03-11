import { sql } from "drizzle-orm";
import {
   boolean,
   date,
   index,
   numeric,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { contacts } from "./contacts";
import { serviceSourceEnum, subscriptionStatusEnum } from "./enums";
import { serviceVariants } from "./services";

export const contactSubscriptions = pgTable(
   "contact_subscriptions",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      contactId: uuid("contact_id")
         .notNull()
         .references(() => contacts.id, { onDelete: "cascade" }),
      variantId: uuid("variant_id")
         .notNull()
         .references(() => serviceVariants.id, { onDelete: "cascade" }),
      startDate: date("start_date").notNull(),
      endDate: date("end_date"),
      negotiatedPrice: numeric("negotiated_price", {
         precision: 12,
         scale: 2,
      }).notNull(),
      notes: text("notes"),
      status: subscriptionStatusEnum("status").notNull().default("active"),
      source: serviceSourceEnum("source").notNull().default("manual"),
      externalId: text("external_id"),
      currentPeriodStart: date("current_period_start"),
      currentPeriodEnd: date("current_period_end"),
      cancelAtPeriodEnd: boolean("cancel_at_period_end")
         .notNull()
         .default(false),
      canceledAt: timestamp("canceled_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("contact_subscriptions_team_id_idx").on(table.teamId),
      index("contact_subscriptions_contact_id_idx").on(table.contactId),
      index("contact_subscriptions_variant_id_idx").on(table.variantId),
      index("contact_subscriptions_external_id_idx").on(table.externalId),
      index("contact_subscriptions_status_idx").on(table.status),
   ],
);

export type ContactSubscription = typeof contactSubscriptions.$inferSelect;
export type NewContactSubscription = typeof contactSubscriptions.$inferInsert;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateStringSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const priceSchema = z.string().refine((v) => !Number.isNaN(Number(v)), {
   message: "Preço deve ser um número válido.",
});

const baseSubscriptionSchema = createInsertSchema(contactSubscriptions).pick({
   contactId: true,
   variantId: true,
   startDate: true,
   endDate: true,
   negotiatedPrice: true,
   notes: true,
   status: true,
   source: true,
   externalId: true,
   currentPeriodStart: true,
   currentPeriodEnd: true,
   cancelAtPeriodEnd: true,
});

export const createSubscriptionSchema = baseSubscriptionSchema.extend({
   contactId: z.string().uuid("ID do contato inválido."),
   variantId: z.string().uuid("ID da variante inválido."),
   startDate: dateStringSchema,
   endDate: dateStringSchema.nullable().optional(),
   negotiatedPrice: priceSchema,
   notes: z
      .string()
      .max(500, "Notas devem ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   externalId: z.string().nullable().optional(),
   currentPeriodStart: dateStringSchema.nullable().optional(),
   currentPeriodEnd: dateStringSchema.nullable().optional(),
   cancelAtPeriodEnd: z.boolean().default(false),
});

export const updateSubscriptionSchema = baseSubscriptionSchema
   .extend({
      startDate: dateStringSchema.optional(),
      endDate: dateStringSchema.nullable().optional(),
      negotiatedPrice: priceSchema.optional(),
      notes: z
         .string()
         .max(500, "Notas devem ter no máximo 500 caracteres.")
         .nullable()
         .optional(),
      externalId: z.string().nullable().optional(),
      currentPeriodStart: dateStringSchema.nullable().optional(),
      currentPeriodEnd: dateStringSchema.nullable().optional(),
      cancelAtPeriodEnd: z.boolean().optional(),
   })
   .partial();

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
