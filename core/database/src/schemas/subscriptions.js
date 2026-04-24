import { sql } from "drizzle-orm";
import { boolean, index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { contacts, serviceSourceEnum } from "@core/database/schemas/contacts";
import { coupons } from "@core/database/schemas/coupons";
import { crmSchema } from "@core/database/schemas/schemas";
export const billingCycleEnum = crmSchema.enum("billing_cycle", [
   "hourly",
   "monthly",
   "annual",
   "one_time",
]);
export const subscriptionStatusEnum = crmSchema.enum("subscription_status", [
   "active",
   "trialing",
   "incomplete",
   "completed",
   "cancelled",
]);
export const contactSubscriptions = crmSchema.table(
   "contact_subscriptions",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      contactId: uuid("contact_id")
         .notNull()
         .references(() => contacts.id, { onDelete: "cascade" }),
      startDate: text("start_date").notNull(),
      endDate: text("end_date"),
      notes: text("notes"),
      status: subscriptionStatusEnum("status").notNull().default("active"),
      source: serviceSourceEnum("source").notNull().default("manual"),
      externalId: text("external_id"),
      couponId: uuid("coupon_id").references(() => coupons.id, {
         onDelete: "set null",
      }),
      trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
      currentPeriodStart: timestamp("current_period_start", {
         withTimezone: true,
      }),
      currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
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
      index("contact_subscriptions_external_id_idx").on(table.externalId),
      index("contact_subscriptions_status_idx").on(table.status),
      index("contact_subscriptions_coupon_id_idx").on(table.couponId),
   ],
);
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const dateStringSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");
const baseSubscriptionSchema = createInsertSchema(contactSubscriptions).pick({
   contactId: true,
   startDate: true,
   endDate: true,
   notes: true,
   status: true,
   source: true,
   externalId: true,
   couponId: true,
   cancelAtPeriodEnd: true,
});
export const createSubscriptionSchema = baseSubscriptionSchema.extend({
   contactId: z.string().uuid("ID do contato inválido."),
   startDate: dateStringSchema,
   endDate: dateStringSchema.nullable().optional(),
   notes: z
      .string()
      .max(500, "Notas devem ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   externalId: z.string().nullable().optional(),
   couponId: z.string().uuid().nullable().optional(),
   cancelAtPeriodEnd: z.boolean().default(false),
});
export const updateSubscriptionSchema = baseSubscriptionSchema
   .extend({
      startDate: dateStringSchema.optional(),
      endDate: dateStringSchema.nullable().optional(),
      notes: z
         .string()
         .max(500, "Notas devem ter no máximo 500 caracteres.")
         .nullable()
         .optional(),
      externalId: z.string().nullable().optional(),
      couponId: z.string().uuid().nullable().optional(),
      cancelAtPeriodEnd: z.boolean().optional(),
      trialEndsAt: z.string().datetime().nullable().optional(),
      currentPeriodStart: z.string().datetime().nullable().optional(),
      currentPeriodEnd: z.string().datetime().nullable().optional(),
   })
   .partial();
