import { sql } from "drizzle-orm";
import { index, integer, numeric, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { servicePrices } from "@core/database/schemas/services";
import { crmSchema } from "@core/database/schemas/schemas";

export const subscriptionItems = crmSchema.table(
   "subscription_items",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      subscriptionId: uuid("subscription_id")
         .notNull()
         .references(() => contactSubscriptions.id, { onDelete: "cascade" }),
      priceId: uuid("price_id")
         .notNull()
         .references(() => servicePrices.id, { onDelete: "restrict" }),
      teamId: uuid("team_id").notNull(),
      quantity: integer("quantity").notNull().default(1),
      negotiatedPrice: numeric("negotiated_price", { precision: 12, scale: 2 }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("subscription_items_subscription_id_idx").on(table.subscriptionId),
      index("subscription_items_price_id_idx").on(table.priceId),
      index("subscription_items_team_id_idx").on(table.teamId),
   ],
);

export type SubscriptionItem = typeof subscriptionItems.$inferSelect;
export type NewSubscriptionItem = typeof subscriptionItems.$inferInsert;

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Preço deve ser um número válido maior ou igual a zero.",
   });

export const createSubscriptionItemSchema = createInsertSchema(
   subscriptionItems,
)
   .pick({
      subscriptionId: true,
      priceId: true,
      quantity: true,
      negotiatedPrice: true,
   })
   .extend({
      subscriptionId: z.string().uuid("ID da assinatura inválido."),
      priceId: z.string().uuid("ID do preço inválido."),
      quantity: z.number().int().min(1).default(1),
      negotiatedPrice: priceSchema.nullable().optional(),
   });

export const updateSubscriptionItemSchema = z.object({
   quantity: z.number().int().min(1).optional(),
   negotiatedPrice: priceSchema.nullable().optional(),
});

export type CreateSubscriptionItemInput = z.infer<
   typeof createSubscriptionItemSchema
>;
export type UpdateSubscriptionItemInput = z.infer<
   typeof updateSubscriptionItemSchema
>;
