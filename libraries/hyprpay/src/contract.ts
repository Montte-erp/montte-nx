import { oc } from "@orpc/contract";
import { z } from "zod";

export const contactByIdRef = z.union([
   z.object({ id: z.string().uuid() }),
   z.object({ externalId: z.string().min(1) }),
]);

export const contactFkRef = z.union([
   z.object({ contactId: z.string().uuid() }),
   z.object({ externalId: z.string().min(1) }),
]);

export type ContactByIdRef = z.infer<typeof contactByIdRef>;
export type ContactFkRef = z.infer<typeof contactFkRef>;

const ingestUsageInput = z.union([
   z.object({
      contactId: z.string().uuid(),
      meterId: z.string().uuid(),
      quantity: z.number().positive(),
      idempotencyKey: z.string().optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
   }),
   z.object({
      externalId: z.string().min(1),
      meterId: z.string().uuid(),
      quantity: z.number().positive(),
      idempotencyKey: z.string().optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
   }),
]);

const createSubscriptionInput = z.union([
   z.object({
      contactId: z.string().uuid(),
      items: z
         .array(
            z.object({
               priceId: z.string().uuid(),
               quantity: z.number().int().min(1).optional(),
            }),
         )
         .min(1),
      couponCode: z.string().optional(),
      status: z.enum(["active", "trialing"]).optional(),
      trialEndsAt: z.string().datetime().nullable().optional(),
      startDate: z.string().optional(),
      endDate: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
   }),
   z.object({
      externalId: z.string().min(1),
      items: z
         .array(
            z.object({
               priceId: z.string().uuid(),
               quantity: z.number().int().min(1).optional(),
            }),
         )
         .min(1),
      couponCode: z.string().optional(),
      status: z.enum(["active", "trialing"]).optional(),
      trialEndsAt: z.string().datetime().nullable().optional(),
      startDate: z.string().optional(),
      endDate: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
   }),
]);

const servicesContract = {
   ingestUsage: oc
      .input(ingestUsageInput)
      .output(z.object({ queued: z.boolean(), idempotencyKey: z.string() })),
   createSubscription: oc.input(createSubscriptionInput).output(z.unknown()),
   cancelSubscription: oc
      .input(
         z.object({
            subscriptionId: z.string().uuid(),
            cancelAtPeriodEnd: z.boolean().default(false),
         }),
      )
      .output(z.unknown()),
   getContactSubscriptions: oc.input(contactFkRef).output(z.array(z.unknown())),
   addItem: oc
      .input(
         z.object({
            subscriptionId: z.string().uuid(),
            priceId: z.string().uuid(),
            quantity: z.number().int().min(1).optional(),
         }),
      )
      .output(z.unknown()),
   updateItem: oc
      .input(
         z.object({
            itemId: z.string().uuid(),
            quantity: z.number().int().min(1).optional(),
            negotiatedPrice: z.string().nullable().optional(),
         }),
      )
      .output(z.unknown()),
   removeItem: oc
      .input(z.object({ itemId: z.string().uuid() }))
      .output(z.object({ success: z.boolean() })),
};

const contactsContract = {
   create: oc
      .input(
         z.object({
            name: z.string().min(1),
            type: z.enum(["cliente", "fornecedor", "ambos"]).optional(),
            email: z.string().email().nullable().optional(),
            phone: z.string().nullable().optional(),
            document: z.string().nullable().optional(),
            externalId: z.string().nullable().optional(),
         }),
      )
      .output(z.unknown()),
   getAll: oc
      .input(
         z
            .object({
               type: z.enum(["cliente", "fornecedor", "ambos"]).optional(),
            })
            .optional(),
      )
      .output(z.array(z.unknown())),
   getById: oc.input(contactByIdRef).output(z.unknown()),
   getStats: oc.input(contactByIdRef).output(z.unknown()),
   getTransactions: oc
      .input(
         z.union([
            z.object({
               id: z.string().uuid(),
               page: z.number().int().min(1).optional(),
               pageSize: z.number().int().min(1).max(100).optional(),
            }),
            z.object({
               externalId: z.string().min(1),
               page: z.number().int().min(1).optional(),
               pageSize: z.number().int().min(1).max(100).optional(),
            }),
         ]),
      )
      .output(z.unknown()),
   update: oc
      .input(
         z.union([
            z.object({
               id: z.string().uuid(),
               name: z.string().min(1).optional(),
               email: z.string().email().nullable().optional(),
               phone: z.string().nullable().optional(),
               document: z.string().nullable().optional(),
            }),
            z.object({
               externalId: z.string().min(1),
               name: z.string().min(1).optional(),
               email: z.string().email().nullable().optional(),
               phone: z.string().nullable().optional(),
               document: z.string().nullable().optional(),
            }),
         ]),
      )
      .output(z.unknown()),
   remove: oc.input(contactByIdRef).output(z.object({ success: z.boolean() })),
   bulkRemove: oc
      .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
      .output(z.object({ deleted: z.number() })),
   archive: oc.input(contactByIdRef).output(z.unknown()),
   reactivate: oc.input(contactByIdRef).output(z.unknown()),
};

const couponScope = z.enum(["team", "price"]);
const couponType = z.enum(["percent", "fixed"]);
const couponDuration = z.enum(["once", "repeating", "forever"]);
const amountString = z
   .string()
   .regex(/^\d+(\.\d+)?$/, "Valor deve ser um número positivo.");

const createCouponInput = z
   .object({
      code: z.string().min(1).max(50),
      scope: couponScope.default("team"),
      priceId: z.string().uuid().nullable().optional(),
      type: couponType,
      amount: amountString,
      duration: couponDuration,
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

const updateCouponInput = z.object({
   id: z.string().uuid(),
   isActive: z.boolean().optional(),
   maxUses: z.number().int().min(1).nullable().optional(),
   redeemBy: z.string().datetime().nullable().optional(),
});

const couponsContract = {
   list: oc.input(z.void().optional()).output(z.array(z.unknown())),
   get: oc.input(z.object({ id: z.string().uuid() })).output(z.unknown()),
   create: oc.input(createCouponInput).output(z.unknown()),
   update: oc.input(updateCouponInput).output(z.unknown()),
   deactivate: oc
      .input(z.object({ id: z.string().uuid() }))
      .output(z.unknown()),
   validate: oc
      .input(
         z.object({
            code: z.string().min(1),
            priceId: z.string().uuid().optional(),
         }),
      )
      .output(
         z.discriminatedUnion("valid", [
            z.object({ valid: z.literal(true), coupon: z.unknown() }),
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
      .input(z.object({ externalId: z.string().min(1) }))
      .output(z.object({ url: z.string() })),
};

export const billingContract = {
   services: servicesContract,
   contacts: contactsContract,
   coupons: couponsContract,
   customerPortal: customerPortalContract,
};

export type BillingContract = typeof billingContract;
