import { ensureContactOwnership } from "@core/database/repositories/contacts-repository";
import {
   createBenefit as createBenefitRepo,
   deleteBenefit,
   ensureBenefitOwnership,
   attachBenefitToService,
   detachBenefitFromService,
   listBenefitsByService,
   updateBenefit,
} from "@core/database/repositories/benefits-repository";
import {
   createMeter as createMeterRepo,
   deleteMeter,
   ensureMeterOwnership,
   listMeters,
   updateMeter,
} from "@core/database/repositories/meters-repository";
import {
   addSubscriptionItem,
   ensureSubscriptionItemOwnership,
   listSubscriptionItems,
   removeSubscriptionItem,
   updateSubscriptionItemQuantity,
} from "@core/database/repositories/subscription-items-repository";
import {
   bulkCreateServices,
   createService,
   createPrice as createVariantRepo,
   deletePrice as deleteVariant,
   deleteService,
   ensurePriceOwnership as ensureVariantOwnership,
   ensureServiceOwnership,
   listPricesByService as listVariantsByService,
   listServices,
   updatePrice as updateVariantRepo,
   updateService,
} from "@core/database/repositories/services-repository";
import {
   createSubscription as createSubscriptionRepo,
   ensureSubscriptionOwnership,
   listExpiringSoon,
   listSubscriptionsByContact,
   listSubscriptionsByTeam,
   updateSubscription,
} from "@core/database/repositories/subscriptions-repository";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { servicePrices } from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { createBillableProcedure } from "@core/orpc/billable";
import { BILLING_EVENTS } from "../constants";
import {
   createServiceSchema,
   createSubscriptionItemSchema,
   createMeterSchema,
   createBenefitSchema,
   upsertUsageEventSchema,
   listServicesInputSchema,
   listSubscriptionsInputSchema,
   createSubscriptionWithItemsInputSchema,
   listExpiringSoonInputSchema,
   serviceBenefitLinkSchema,
   idInputSchema,
   serviceIdInputSchema,
   priceIdInputSchema,
   contactIdInputSchema,
   subscriptionIdInputSchema,
   bulkCreateServicesInputSchema,
   createPriceForServiceInputSchema,
   updateServiceInputSchema,
   updatePriceInputSchema,
   updateMeterInputSchema,
   updateBenefitInputSchema,
   updateSubscriptionItemInputSchema,
} from "../contracts/services";
import { and, asc, count, eq, sql, sum } from "drizzle-orm";

export const getAll = protectedProcedure
   .input(listServicesInputSchema)
   .handler(async ({ context, input }) =>
      (await listServices(context.db, context.teamId, input)).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const create = protectedProcedure
   .input(createServiceSchema)
   .handler(async ({ context, input }) =>
      (await createService(context.db, context.teamId, input)).match(
         (service) => service,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const bulkCreate = protectedProcedure
   .input(bulkCreateServicesInputSchema)
   .handler(async ({ context, input }) => {
      const inserted = (
         await bulkCreateServices(context.db, context.teamId, input.items)
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      if (inserted.length === 0)
         throw WebAppError.internal("Falha ao importar os serviços.");
      return inserted;
   });

export const update = protectedProcedure
   .input(updateServiceInputSchema)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureServiceOwnership(context.db, id, context.teamId).andThen(
            () => updateService(context.db, id, data),
         )
      ).match(
         (service) => service,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const remove = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteService(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const exportAll = protectedProcedure.handler(async ({ context }) =>
   (await listServices(context.db, context.teamId)).match(
      (rows) => rows,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   ),
);

export const getVariants = protectedProcedure
   .input(serviceIdInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.serviceId,
            context.teamId,
         ).andThen(() => listVariantsByService(context.db, input.serviceId))
      ).match(
         (variants) => variants,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const createVariant = protectedProcedure
   .input(createPriceForServiceInputSchema)
   .handler(async ({ context, input }) => {
      const { serviceId, ...variantData } = input;
      if (input.type === "metered") {
         if (!input.meterId)
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         if (Number(input.basePrice) !== 0)
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
      }
      return (
         await ensureServiceOwnership(
            context.db,
            serviceId,
            context.teamId,
         ).andThen(() =>
            createVariantRepo(
               context.db,
               context.teamId,
               serviceId,
               variantData,
            ),
         )
      ).match(
         (variant) => variant,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const updateVariant = protectedProcedure
   .input(updatePriceInputSchema)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (input.type === "metered") {
         if (input.meterId === null || input.meterId === undefined)
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         if (input.basePrice !== undefined && Number(input.basePrice) !== 0)
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
      }
      return (
         await ensureVariantOwnership(context.db, id, context.teamId).andThen(
            () => updateVariantRepo(context.db, id, data),
         )
      ).match(
         (variant) => variant,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const removeVariant = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureVariantOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteVariant(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getAllSubscriptions = protectedProcedure
   .input(listSubscriptionsInputSchema)
   .handler(async ({ context, input }) =>
      (
         await listSubscriptionsByTeam(
            context.db,
            context.teamId,
            input?.status,
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getContactSubscriptions = protectedProcedure
   .input(contactIdInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureContactOwnership(
            context.db,
            input.contactId,
            context.teamId,
         ).andThen(() =>
            listSubscriptionsByContact(context.db, input.contactId),
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const createSubscription = createBillableProcedure(
   BILLING_EVENTS.subscriptionCreated,
)
   .input(createSubscriptionWithItemsInputSchema)
   .handler(async ({ context, input }) => {
      const sub = (
         await ensureContactOwnership(
            context.db,
            input.contactId,
            context.teamId,
         ).andThen(() =>
            createSubscriptionRepo(context.db, context.teamId, {
               ...input,
               source: "manual",
               cancelAtPeriodEnd: false,
            }),
         )
      ).match(
         (s) => s,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );

      if (input.items && input.items.length > 0) {
         const results = await Promise.allSettled(
            input.items.map((item) =>
               addSubscriptionItem(context.db, context.teamId, {
                  ...item,
                  subscriptionId: sub.id,
               }),
            ),
         );
         if (results.some((r) => r.status === "rejected"))
            throw WebAppError.internal(
               "Falha ao adicionar itens à assinatura.",
            );
      }

      return sub;
   });

export const cancelSubscription = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) => {
      const subscription = (
         await ensureSubscriptionOwnership(context.db, input.id, context.teamId)
      ).match(
         (sub) => sub,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );

      if (!["active", "trialing", "incomplete"].includes(subscription.status))
         throw WebAppError.badRequest(
            "Apenas assinaturas ativas, em trial ou incompletas podem ser canceladas.",
         );
      if (subscription.source === "asaas")
         throw WebAppError.badRequest(
            "Assinaturas do Asaas não podem ser canceladas aqui.",
         );

      return (
         await updateSubscription(context.db, input.id, { status: "cancelled" })
      ).match(
         (cancelled) => cancelled,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getExpiringSoon = protectedProcedure
   .input(listExpiringSoonInputSchema)
   .handler(async ({ context, input }) =>
      (
         await listExpiringSoon(
            context.db,
            context.teamId,
            undefined,
            input?.status,
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const createMeter = createBillableProcedure(BILLING_EVENTS.meterCreated)
   .input(createMeterSchema)
   .handler(async ({ context, input }) =>
      (await createMeterRepo(context.db, context.teamId, input)).match(
         (meter) => meter,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const createBenefit = createBillableProcedure(
   BILLING_EVENTS.benefitCreated,
)
   .input(createBenefitSchema)
   .handler(async ({ context, input }) =>
      (await createBenefitRepo(context.db, context.teamId, input)).match(
         (benefit) => benefit,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const ingestUsage = createBillableProcedure(BILLING_EVENTS.usageIngested)
   .input(upsertUsageEventSchema)
   .handler(async ({ context, input }) => {
      if (input.teamId !== context.teamId)
         throw WebAppError.forbidden(
            "Você não tem permissão para registrar uso neste time.",
         );

      if (!context.hyprpayClient)
         throw WebAppError.internal("HyprPay não está configurado.");

      const customerId = context.organizationId;

      const result = await context.hyprpayClient.usage.ingest({
         customerId,
         meterId: input.meterId,
         quantity: Number(input.quantity),
         idempotencyKey: input.idempotencyKey,
         properties: input.properties ?? {},
      });

      return result.match(
         (r) => ({ queued: r.queued }),
         () => {
            throw WebAppError.internal("Falha ao registrar uso.");
         },
      );
   });

export const getMrr = protectedProcedure.handler(async ({ context }) => {
   const rows = await context.db
      .select({
         total: sum(
            sql<string>`
  CASE ${servicePrices.interval}
    WHEN 'monthly' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric
    WHEN 'annual' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric / 12
    ELSE 0::numeric
  END
`,
         ),
      })
      .from(subscriptionItems)
      .innerJoin(servicePrices, eq(subscriptionItems.priceId, servicePrices.id))
      .innerJoin(
         contactSubscriptions,
         eq(subscriptionItems.subscriptionId, contactSubscriptions.id),
      )
      .where(
         and(
            eq(subscriptionItems.teamId, context.teamId),
            eq(contactSubscriptions.status, "active"),
         ),
      );
   return { mrr: rows[0]?.total ?? "0" };
});

export const getMeters = protectedProcedure.handler(async ({ context }) =>
   (await listMeters(context.db, context.teamId)).match(
      (rows) => rows,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   ),
);

export const getMeterById = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) =>
      (await ensureMeterOwnership(context.db, input.id, context.teamId)).match(
         (meter) => meter,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const updateMeterById = protectedProcedure
   .input(updateMeterInputSchema)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureMeterOwnership(context.db, id, context.teamId).andThen(
            () => updateMeter(context.db, id, data),
         )
      ).match(
         (meter) => meter,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const removeMeter = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureMeterOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteMeter(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getBenefits = protectedProcedure.handler(async ({ context }) => {
   const rows = await context.db
      .select({
         id: benefits.id,
         teamId: benefits.teamId,
         name: benefits.name,
         type: benefits.type,
         meterId: benefits.meterId,
         creditAmount: benefits.creditAmount,
         description: benefits.description,
         isActive: benefits.isActive,
         createdAt: benefits.createdAt,
         updatedAt: benefits.updatedAt,
         usedInServices: count(serviceBenefits.serviceId),
      })
      .from(benefits)
      .leftJoin(serviceBenefits, eq(benefits.id, serviceBenefits.benefitId))
      .where(eq(benefits.teamId, context.teamId))
      .groupBy(benefits.id)
      .orderBy(asc(benefits.name));
   return rows;
});

export const getBenefitById = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureBenefitOwnership(context.db, input.id, context.teamId)
      ).match(
         (benefit) => benefit,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const updateBenefitById = protectedProcedure
   .input(updateBenefitInputSchema)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureBenefitOwnership(context.db, id, context.teamId).andThen(
            () => updateBenefit(context.db, id, data),
         )
      ).match(
         (benefit) => benefit,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const removeBenefit = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureBenefitOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteBenefit(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const attachBenefit = protectedProcedure
   .input(serviceBenefitLinkSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.serviceId,
            context.teamId,
         )
            .andThen(() =>
               ensureBenefitOwnership(
                  context.db,
                  input.benefitId,
                  context.teamId,
               ),
            )
            .andThen(() =>
               attachBenefitToService(
                  context.db,
                  input.serviceId,
                  input.benefitId,
               ),
            )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const detachBenefit = protectedProcedure
   .input(serviceBenefitLinkSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.serviceId,
            context.teamId,
         ).andThen(() =>
            detachBenefitFromService(
               context.db,
               input.serviceId,
               input.benefitId,
            ),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getServiceBenefits = protectedProcedure
   .input(serviceIdInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.serviceId,
            context.teamId,
         ).andThen(() => listBenefitsByService(context.db, input.serviceId))
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getActiveCountByPrice = protectedProcedure
   .input(priceIdInputSchema)
   .handler(async ({ context, input }) => {
      const rows = await context.db
         .select({ count: count() })
         .from(subscriptionItems)
         .innerJoin(
            contactSubscriptions,
            eq(subscriptionItems.subscriptionId, contactSubscriptions.id),
         )
         .where(
            and(
               eq(subscriptionItems.priceId, input.priceId),
               eq(subscriptionItems.teamId, context.teamId),
               eq(contactSubscriptions.status, "active"),
            ),
         );
      return { count: rows[0]?.count ?? 0 };
   });

export const addItem = protectedProcedure
   .input(createSubscriptionItemSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureSubscriptionOwnership(
            context.db,
            input.subscriptionId,
            context.teamId,
         ).andThen(() => addSubscriptionItem(context.db, context.teamId, input))
      ).match(
         (item) => item,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const updateItem = protectedProcedure
   .input(updateSubscriptionItemInputSchema)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureSubscriptionItemOwnership(
            context.db,
            id,
            context.teamId,
         ).andThen(() => updateSubscriptionItemQuantity(context.db, id, data))
      ).match(
         (item) => item,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const removeItem = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureSubscriptionItemOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => removeSubscriptionItem(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const listItems = protectedProcedure
   .input(subscriptionIdInputSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureSubscriptionOwnership(
            context.db,
            input.subscriptionId,
            context.teamId,
         ).andThen(() =>
            listSubscriptionItems(context.db, input.subscriptionId),
         )
      ).match(
         (items) => items,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );
