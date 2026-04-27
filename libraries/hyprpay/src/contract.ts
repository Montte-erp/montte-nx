import { oc } from "@orpc/contract";
import { z } from "zod";

const contactRow = z.object({
   id: z.string().uuid(),
   teamId: z.string().uuid(),
   name: z.string(),
   type: z.enum(["cliente", "fornecedor", "ambos"]),
   email: z.string().nullable(),
   phone: z.string().nullable(),
   document: z.string().nullable(),
   documentType: z.enum(["cpf", "cnpj"]).nullable(),
   notes: z.string().nullable(),
   source: z.enum(["manual", "asaas"]),
   externalId: z.string().nullable(),
   isArchived: z.boolean(),
   createdAt: z.date(),
   updatedAt: z.date(),
});

const contactStatsOutput = z.object({
   totalIncome: z.string(),
   totalExpense: z.string(),
   firstTransactionDate: z.string().nullable(),
});

const contactTransactionsOutput = z.object({
   items: z.array(z.unknown()),
   total: z.number(),
});

const subscriptionRow = z.object({
   id: z.string().uuid(),
   teamId: z.string().uuid(),
   contactId: z.string().uuid(),
   startDate: z.string(),
   endDate: z.string().nullable(),
   notes: z.string().nullable(),
   status: z.enum([
      "active",
      "trialing",
      "incomplete",
      "completed",
      "cancelled",
   ]),
   externalId: z.string().nullable(),
   couponId: z.string().uuid().nullable(),
   trialEndsAt: z.date().nullable(),
   currentPeriodStart: z.date().nullable(),
   currentPeriodEnd: z.date().nullable(),
   cancelAtPeriodEnd: z.boolean(),
   canceledAt: z.date().nullable(),
   createdAt: z.date(),
   updatedAt: z.date(),
});

const subscriptionItemRow = z.object({
   id: z.string().uuid(),
   subscriptionId: z.string().uuid(),
   priceId: z.string().uuid(),
   teamId: z.string().uuid(),
   quantity: z.number().int(),
   negotiatedPrice: z.string().nullable(),
   createdAt: z.date(),
   updatedAt: z.date(),
});

const couponRow = z.object({
   id: z.string().uuid(),
   teamId: z.string().uuid(),
   code: z.string(),
   scope: z.enum(["team", "price"]),
   priceId: z.string().uuid().nullable(),
   type: z.enum(["percent", "fixed"]),
   amount: z.string(),
   duration: z.enum(["once", "repeating", "forever"]),
   durationMonths: z.number().int().nullable(),
   maxUses: z.number().int().nullable(),
   usedCount: z.number().int(),
   redeemBy: z.date().nullable(),
   isActive: z.boolean(),
   createdAt: z.date(),
   updatedAt: z.date(),
});

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

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const isoDateString = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const createSubscriptionInput = z
   .object({
      contactId: z.string().uuid(),
      startDate: isoDateString,
      endDate: isoDateString.nullable().optional(),
      notes: z.string().nullable().optional(),
      status: z.enum(["active", "trialing"]).default("active"),
      trialEndsAt: z.string().datetime().nullable().optional(),
      items: z
         .array(
            z.object({
               priceId: z.string().uuid(),
               quantity: z.number().int().min(1).default(1),
               negotiatedPrice: z
                  .string()
                  .regex(/^\d+(\.\d+)?$/)
                  .nullable()
                  .optional(),
            }),
         )
         .optional(),
   })
   .superRefine((data, ctx) => {
      if (data.status === "trialing" && !data.trialEndsAt) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "trialEndsAt obrigatório para status 'trialing'.",
            path: ["trialEndsAt"],
         });
      }
   });

const ingestUsageEventInput = z
   .object({
      meterId: z.string().uuid().optional(),
      eventName: z.string().min(1).optional(),
      externalId: z.string().min(1).nullable().optional(),
      quantity: z
         .string()
         .regex(/^\d+(\.\d+)?$/, "Quantidade deve ser um número positivo."),
      idempotencyKey: z.string().min(1),
      properties: z.record(z.string(), z.unknown()).optional(),
   })
   .superRefine((data, ctx) => {
      if (!data.meterId && !data.eventName) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe meterId ou eventName.",
            path: ["meterId"],
         });
      }
   });

const servicesContract = {
   ingestUsage: oc
      .input(ingestUsageEventInput)
      .output(z.object({ success: z.literal(true) })),
   createSubscription: oc
      .input(createSubscriptionInput)
      .output(subscriptionRow),
   cancelSubscription: oc
      .input(z.object({ id: z.string().uuid() }))
      .output(subscriptionRow),
   getContactSubscriptions: oc
      .input(z.object({ contactId: z.string().uuid() }))
      .output(z.array(subscriptionRow)),
   addItem: oc
      .input(
         z.object({
            subscriptionId: z.string().uuid(),
            priceId: z.string().uuid(),
            quantity: z.number().int().min(1).default(1),
            negotiatedPrice: z
               .string()
               .regex(/^\d+(\.\d+)?$/)
               .nullable()
               .optional(),
         }),
      )
      .output(subscriptionItemRow),
   updateItem: oc
      .input(
         z.object({
            id: z.string().uuid(),
            quantity: z.number().int().min(1).optional(),
            negotiatedPrice: z
               .string()
               .regex(/^\d+(\.\d+)?$/)
               .nullable()
               .optional(),
         }),
      )
      .output(subscriptionItemRow),
   removeItem: oc
      .input(z.object({ id: z.string().uuid() }))
      .output(z.object({ success: z.literal(true) })),
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
      .output(contactRow),
   getAll: oc
      .input(
         z
            .object({
               type: z.enum(["cliente", "fornecedor", "ambos"]).optional(),
            })
            .optional(),
      )
      .output(z.array(contactRow)),
   getById: oc.input(contactByIdRef).output(contactRow),
   getStats: oc.input(contactByIdRef).output(contactStatsOutput),
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
      .output(contactTransactionsOutput),
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
      .output(contactRow),
   remove: oc.input(contactByIdRef).output(z.object({ success: z.boolean() })),
   bulkRemove: oc
      .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
      .output(z.object({ deleted: z.number() })),
   archive: oc.input(contactByIdRef).output(contactRow),
   reactivate: oc.input(contactByIdRef).output(contactRow),
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
   list: oc.input(z.void().optional()).output(z.array(couponRow)),
   get: oc.input(z.object({ id: z.string().uuid() })).output(couponRow),
   create: oc.input(createCouponInput).output(couponRow),
   update: oc.input(updateCouponInput).output(couponRow),
   deactivate: oc.input(z.object({ id: z.string().uuid() })).output(couponRow),
   validate: oc
      .input(
         z.object({
            code: z.string().min(1),
            priceId: z.string().uuid().optional(),
         }),
      )
      .output(
         z.discriminatedUnion("valid", [
            z.object({
               valid: z.literal(true),
               coupon: z.object({
                  id: z.string().uuid(),
                  code: z.string(),
                  type: z.enum(["percent", "fixed"]),
                  amount: z.string(),
                  duration: z.enum(["once", "repeating", "forever"]),
                  durationMonths: z.number().int().nullable(),
                  scope: z.enum(["team", "price"]),
                  priceId: z.string().uuid().nullable(),
                  maxUses: z.number().int().nullable(),
                  usedCount: z.number().int(),
                  redeemBy: z.string().nullable(),
               }),
            }),
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
