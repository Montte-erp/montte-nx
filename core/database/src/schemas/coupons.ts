import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   jsonb,
   numeric,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { contacts } from "@core/database/schemas/contacts";
import { crmSchema } from "@core/database/schemas/schemas";
import { servicePrices } from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";

export const couponScopeEnum = crmSchema.enum("coupon_scope", [
   "team",
   "price",
]);
export const couponTypeEnum = crmSchema.enum("coupon_type", [
   "percent",
   "fixed",
]);
export const couponDurationEnum = crmSchema.enum("coupon_duration", [
   "once",
   "repeating",
   "forever",
]);

export type CouponScope = (typeof couponScopeEnum.enumValues)[number];
export type CouponType = (typeof couponTypeEnum.enumValues)[number];
export type CouponDuration = (typeof couponDurationEnum.enumValues)[number];

export const coupons = crmSchema.table(
   "coupons",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      code: text("code").notNull(),
      scope: couponScopeEnum("scope").notNull().default("team"),
      priceId: uuid("price_id").references(() => servicePrices.id, {
         onDelete: "set null",
      }),
      type: couponTypeEnum("type").notNull(),
      amount: numeric("amount", { precision: 12, scale: 4 }).notNull(),
      duration: couponDurationEnum("duration").notNull(),
      durationMonths: integer("duration_months"),
      maxUses: integer("max_uses"),
      usedCount: integer("used_count").notNull().default(0),
      redeemBy: timestamp("redeem_by", { withTimezone: true }),
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
      uniqueIndex("coupons_team_id_code_idx").on(
         table.teamId,
         sql`lower(${table.code})`,
      ),
      index("coupons_team_id_idx").on(table.teamId),
   ],
);

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;

export const couponRedemptions = crmSchema.table(
   "coupon_redemptions",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      couponId: uuid("coupon_id")
         .notNull()
         .references(() => coupons.id, { onDelete: "restrict" }),
      subscriptionId: uuid("subscription_id")
         .notNull()
         .references(() => contactSubscriptions.id, { onDelete: "cascade" }),
      contactId: uuid("contact_id")
         .notNull()
         .references(() => contacts.id, { onDelete: "cascade" }),
      discountSnapshot: jsonb("discount_snapshot")
         .$type<{
            code: string;
            type: CouponType;
            amount: string;
            duration: CouponDuration;
            durationMonths: number | null;
         }>()
         .notNull(),
      redeemedAt: timestamp("redeemed_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [
      index("coupon_redemptions_coupon_id_idx").on(table.couponId),
      index("coupon_redemptions_subscription_id_idx").on(table.subscriptionId),
      index("coupon_redemptions_team_id_idx").on(table.teamId),
   ],
);

export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type NewCouponRedemption = typeof couponRedemptions.$inferInsert;

const amountSchema = z
   .string()
   .regex(/^\d+(\.\d+)?$/, "Valor deve ser um número positivo.")
   .refine((v) => parseFloat(v) > 0, {
      message: "Valor deve ser um número positivo.",
   });

export const createCouponSchema = z
   .object({
      code: z
         .string()
         .min(1)
         .max(50, "Código deve ter no máximo 50 caracteres."),
      scope: z.enum(couponScopeEnum.enumValues).default("team"),
      priceId: z.string().uuid().nullable().optional(),
      type: z.enum(couponTypeEnum.enumValues),
      amount: amountSchema,
      duration: z.enum(couponDurationEnum.enumValues),
      durationMonths: z.number().int().min(1).nullable().optional(),
      maxUses: z.number().int().min(1).nullable().optional(),
      redeemBy: z.string().datetime().nullable().optional(),
   })
   .superRefine((data, ctx) => {
      if (data.scope === "price" && !data.priceId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "priceId é obrigatório quando escopo é 'price'.",
            path: ["priceId"],
         });
      }
      if (data.duration === "repeating" && !data.durationMonths) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
               "durationMonths é obrigatório quando duração é 'repeating'.",
            path: ["durationMonths"],
         });
      }
   });

export const updateCouponSchema = z.object({
   isActive: z.boolean().optional(),
   maxUses: z.number().int().min(1).nullable().optional(),
   redeemBy: z.string().datetime().nullable().optional(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
