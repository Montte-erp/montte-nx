import { sql } from "drizzle-orm";
import {
   index,
   jsonb,
   numeric,
   timestamp,
   uuid,
   text,
} from "drizzle-orm/pg-core";
import { platformSchema } from "@core/database/schemas/schemas";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { team } from "@core/database/schemas/auth";

export const invoiceStatusEnum = platformSchema.enum("invoice_status", [
   "draft",
   "open",
   "paid",
   "void",
]);

export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];

export type InvoiceLineItem = {
   description: string;
   meterId: string | null;
   quantity: string;
   unitPrice: string;
   subtotal: string;
};

export const invoices = platformSchema.table(
   "invoices",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      subscriptionId: uuid("subscription_id")
         .notNull()
         .references(() => contactSubscriptions.id, { onDelete: "restrict" }),
      status: invoiceStatusEnum("status").notNull().default("draft"),
      periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
      periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
      subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
      discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      total: numeric("total", { precision: 12, scale: 2 }).notNull(),
      lineItems: jsonb("line_items")
         .$type<InvoiceLineItem[]>()
         .notNull()
         .default(sql`'[]'::jsonb`),
      couponSnapshot: jsonb("coupon_snapshot")
         .$type<{
            code: string;
            type: string;
            amount: string;
            duration: string;
         } | null>()
         .default(sql`NULL`),
      notes: text("notes"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("invoices_team_id_idx").on(table.teamId),
      index("invoices_subscription_id_idx").on(table.subscriptionId),
      index("invoices_status_idx").on(table.status),
      index("invoices_period_end_idx").on(table.periodEnd),
   ],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
