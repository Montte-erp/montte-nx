import { oc } from "@orpc/contract";
import { z } from "zod";

const customerSchema = z.object({
   id: z.string(),
   teamId: z.string(),
   name: z.string(),
   email: z.string().nullable(),
   phone: z.string().nullable(),
   document: z.string().nullable(),
   externalId: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

const listResultSchema = z.object({
   items: z.array(customerSchema),
   total: z.number(),
   page: z.number(),
   limit: z.number(),
   pages: z.number(),
});

const subscriptionItemSchema = z.object({
   id: z.string(),
   subscriptionId: z.string(),
   priceId: z.string(),
   quantity: z.number(),
   negotiatedPrice: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

const subscriptionSchema = z.object({
   id: z.string(),
   contactId: z.string(),
   teamId: z.string(),
   status: z.enum([
      "active",
      "trialing",
      "incomplete",
      "completed",
      "cancelled",
   ]),
   startDate: z.string(),
   endDate: z.string().nullable(),
   couponId: z.string().nullable(),
   cancelAtPeriodEnd: z.boolean(),
   checkoutUrl: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

const subscriptionsContract = {
   create: oc
      .input(
         z.object({
            customerId: z.string(),
            items: z
               .array(
                  z.object({
                     priceId: z.string(),
                     quantity: z.number().int().min(1).optional(),
                  }),
               )
               .min(1),
            couponCode: z.string().optional(),
         }),
      )
      .output(
         z.object({
            subscription: subscriptionSchema,
            checkoutUrl: z.string().nullable(),
         }),
      ),

   cancel: oc
      .input(
         z.object({
            subscriptionId: z.string(),
            cancelAtPeriodEnd: z.boolean().default(false),
         }),
      )
      .output(subscriptionSchema),

   list: oc
      .input(z.object({ customerId: z.string() }))
      .output(z.array(subscriptionSchema)),

   addItem: oc
      .input(
         z.object({
            subscriptionId: z.string(),
            priceId: z.string(),
            quantity: z.number().int().min(1).optional(),
         }),
      )
      .output(subscriptionItemSchema),

   updateItem: oc
      .input(
         z.object({
            itemId: z.string(),
            quantity: z.number().int().min(1).optional(),
            negotiatedPrice: z.string().nullable().optional(),
         }),
      )
      .output(subscriptionItemSchema),

   removeItem: oc
      .input(z.object({ itemId: z.string() }))
      .output(z.object({ success: z.boolean() })),
};

const usageEventSchema = z.object({
   teamId: z.string(),
   meterId: z.string(),
   quantity: z.number(),
   idempotencyKey: z.string(),
   contactId: z.string().nullable(),
   properties: z.record(z.string(), z.unknown()),
   timestamp: z.string(),
});

const benefitGrantSchema = z.object({
   id: z.string(),
   benefitId: z.string(),
   subscriptionId: z.string(),
   status: z.enum(["active", "revoked"]),
   grantedAt: z.string(),
   revokedAt: z.string().nullable(),
   benefit: z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["credits", "feature_access", "custom"]),
      description: z.string().nullable(),
   }),
});

const benefitsContract = {
   check: oc
      .input(z.object({ customerId: z.string(), benefitId: z.string() }))
      .output(
         z.object({
            status: z.enum(["granted", "revoked", "not_found"]),
            grantedAt: z.string().nullable(),
            revokedAt: z.string().nullable(),
            subscriptionId: z.string().nullable(),
         }),
      ),

   list: oc
      .input(z.object({ customerId: z.string() }))
      .output(z.array(benefitGrantSchema)),
};

const usageContract = {
   ingest: oc
      .input(
         z.object({
            customerId: z.string(),
            meterId: z.string(),
            quantity: z.number().positive(),
            properties: z.record(z.string(), z.unknown()).optional(),
            idempotencyKey: z.string().optional(),
         }),
      )
      .output(z.object({ queued: z.boolean(), idempotencyKey: z.string() })),

   list: oc
      .input(
         z.object({ customerId: z.string(), meterId: z.string().optional() }),
      )
      .output(z.array(usageEventSchema)),
};

const couponDetailSchema = z.object({
   id: z.string(),
   code: z.string(),
   type: z.enum(["percent", "fixed"]),
   amount: z.string(),
   duration: z.enum(["once", "repeating", "forever"]),
   durationMonths: z.number().nullable(),
   scope: z.enum(["team", "price"]),
   priceId: z.string().nullable(),
   maxUses: z.number().nullable(),
   usedCount: z.number(),
   redeemBy: z.string().nullable(),
});

const couponsContract = {
   validate: oc
      .input(z.object({ code: z.string(), priceId: z.string().optional() }))
      .output(
         z.discriminatedUnion("valid", [
            z.object({ valid: z.literal(true), coupon: couponDetailSchema }),
            z.object({
               valid: z.literal(false),
               reason: z.enum([
                  "not_found",
                  "inactive",
                  "expired",
                  "max_uses_reached",
                  "price_scope_mismatch",
               ]),
            }),
         ]),
      ),
};

const customerPortalContract = {
   createSession: oc
      .input(z.object({ customerId: z.string() }))
      .output(z.object({ url: z.string(), expiresAt: z.string() })),
};

export const hyprpayContract = {
   create: oc
      .input(
         z.object({
            name: z.string().min(1),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            document: z.string().optional(),
            externalId: z.string().optional(),
         }),
      )
      .output(customerSchema),

   get: oc.input(z.object({ externalId: z.string() })).output(customerSchema),

   list: oc
      .input(
         z.object({
            page: z.number().int().min(1).default(1),
            limit: z.number().int().min(1).max(100).default(20),
         }),
      )
      .output(listResultSchema),

   update: oc
      .input(
         z.object({
            externalId: z.string(),
            name: z.string().min(1).optional(),
            email: z.string().email().nullable().optional(),
            phone: z.string().nullable().optional(),
         }),
      )
      .output(customerSchema),

   subscriptions: subscriptionsContract,
   usage: usageContract,
   benefits: benefitsContract,
   coupons: couponsContract,
   customerPortal: customerPortalContract,
};

export type HyprPayUsageEventFromContract = z.infer<typeof usageEventSchema>;
export type HyprPayCustomerFromContract = z.infer<typeof customerSchema>;
export type HyprPaySubscriptionFromContract = z.infer<
   typeof subscriptionSchema
>;
export type HyprPaySubscriptionItemFromContract = z.infer<
   typeof subscriptionItemSchema
>;
export type HyprPayBenefitGrantFromContract = z.infer<
   typeof benefitGrantSchema
>;
export type HyprPayCouponFromContract = z.infer<typeof couponDetailSchema>;
