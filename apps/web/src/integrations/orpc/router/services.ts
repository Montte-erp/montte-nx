import { ensureContactOwnership } from "@core/database/repositories/contacts-repository";
import {
   createBenefit as createBenefitRepo,
   updateBenefit,
   deleteBenefit,
   ensureBenefitOwnership,
   attachBenefitToService,
   detachBenefitFromService,
   listBenefitsByService,
} from "@core/database/repositories/benefits-repository";
import {
   createMeter as createMeterRepo,
   listMeters,
   updateMeter,
   deleteMeter,
   ensureMeterOwnership,
} from "@core/database/repositories/meters-repository";
import {
   addSubscriptionItem,
   updateSubscriptionItemQuantity,
   removeSubscriptionItem,
   listSubscriptionItems,
   ensureSubscriptionItemOwnership,
} from "@core/database/repositories/subscription-items-repository";
import {
   bulkCreateServices,
   createService,
   createPrice as createVariantRepo,
   deleteService,
   deletePrice as deleteVariant,
   ensureServiceOwnership,
   ensurePriceOwnership as ensureVariantOwnership,
   listServices,
   listPricesByService as listVariantsByService,
   updateService,
   updatePrice as updateVariantRepo,
} from "@core/database/repositories/services-repository";
import {
   createSubscription as createSubscriptionRepo,
   ensureSubscriptionOwnership,
   listExpiringSoon,
   listSubscriptionsByContact,
   listSubscriptionsByTeam,
   updateSubscription,
} from "@core/database/repositories/subscriptions-repository";
import {
   createBenefitSchema,
   benefits,
   serviceBenefits,
   updateBenefitSchema,
} from "@core/database/schemas/benefits";
import {
   createMeterSchema,
   updateMeterSchema,
} from "@core/database/schemas/meters";
import {
   createSubscriptionItemSchema,
   updateSubscriptionItemSchema,
   subscriptionItems,
} from "@core/database/schemas/subscription-items";
import {
   createServiceSchema,
   updateServiceSchema,
   createPriceSchema as createVariantSchema,
   updatePriceSchema as updateVariantSchema,
   servicePrices,
} from "@core/database/schemas/services";
import {
   contactSubscriptions,
   createSubscriptionSchema,
} from "@core/database/schemas/subscriptions";
import { upsertUsageEventSchema } from "@core/database/schemas/usage-events";
import { WebAppError } from "@core/logging/errors";
import {
   emitServiceBenefitCreated,
   emitServiceMeterCreated,
   emitSubscriptionCreated,
   emitUsageIngested,
} from "@packages/events/service";
import { enqueueUsageIngestionWorkflow } from "@packages/workflows/workflows/billing/usage-ingestion-workflow";
import { eq, and, sum, sql, count, asc } from "drizzle-orm";
import { z } from "zod";
import { createBillableProcedure } from "../billable";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const getAll = protectedProcedure
   .input(
      z
         .object({
            search: z.string().optional(),
            categoryId: z.string().uuid().optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      return (await listServices(context.db, context.teamId, input)).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const create = protectedProcedure
   .input(createServiceSchema)
   .handler(async ({ context, input }) => {
      return (await createService(context.db, context.teamId, input)).match(
         (service) => service,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const bulkCreate = protectedProcedure
   .input(z.object({ items: z.array(createServiceSchema).min(1) }))
   .handler(async ({ context, input }) => {
      const inserted = (
         await bulkCreateServices(context.db, context.teamId, input.items)
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      if (inserted.length === 0) {
         throw WebAppError.internal("Falha ao importar os serviços.");
      }
      return inserted;
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateServiceSchema))
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
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return (
         await ensureServiceOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteService(context.db, input.id))
      ).match(
         () => ({ success: true }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   return (await listServices(context.db, context.teamId)).match(
      (rows) => rows,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   );
});

export const getVariants = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
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
      );
   });

export const createVariant = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }).merge(createVariantSchema))
   .handler(async ({ context, input }) => {
      const { serviceId, ...variantData } = input;
      if (input.type === "metered") {
         if (!input.meterId) {
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         }
         if (Number(input.basePrice) !== 0) {
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
         }
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
   .input(idSchema.merge(updateVariantSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (input.type === "metered") {
         if (input.meterId === null || input.meterId === undefined) {
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         }
         if (input.basePrice !== undefined && Number(input.basePrice) !== 0) {
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
         }
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
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return (
         await ensureVariantOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteVariant(context.db, input.id))
      ).match(
         () => ({ success: true }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getAllSubscriptions = protectedProcedure
   .input(
      z
         .object({
            status: z.enum(["active", "completed", "cancelled"]).optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      return (
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
      );
   });

export const getContactSubscriptions = protectedProcedure
   .input(z.object({ contactId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
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
      );
   });

export const createSubscription = createBillableProcedure(
   "subscription.created",
)
   .input(
      createSubscriptionSchema
         .pick({
            contactId: true,
            startDate: true,
            endDate: true,
            notes: true,
         })
         .extend({
            items: z
               .array(
                  createSubscriptionItemSchema.omit({ subscriptionId: true }),
               )
               .optional(),
         }),
   )
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
         const itemResults = await Promise.allSettled(
            input.items.map((item) =>
               addSubscriptionItem(context.db, context.teamId, {
                  ...item,
                  subscriptionId: sub.id,
               }),
            ),
         );
         const failed = itemResults.filter((r) => r.status === "rejected");
         if (failed.length > 0) {
            throw WebAppError.internal(
               "Falha ao adicionar itens à assinatura.",
            );
         }
      }

      context.scheduleEmit(() =>
         emitSubscriptionCreated(context.emit, context.emitCtx, {
            subscriptionId: sub.id,
            contactId: sub.contactId,
         }),
      );

      return sub;
   });

export const cancelSubscription = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const subscription = (
         await ensureSubscriptionOwnership(context.db, input.id, context.teamId)
      ).match(
         (sub) => sub,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );

      if (!["active", "trialing", "incomplete"].includes(subscription.status)) {
         throw WebAppError.badRequest(
            "Apenas assinaturas ativas, em trial ou incompletas podem ser canceladas.",
         );
      }

      if (subscription.source === "asaas") {
         throw WebAppError.badRequest(
            "Assinaturas do Asaas não podem ser canceladas aqui.",
         );
      }

      return (
         await updateSubscription(context.db, input.id, {
            status: "cancelled",
         })
      ).match(
         (cancelled) => cancelled,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getExpiringSoon = protectedProcedure
   .input(
      z
         .object({
            status: z.enum(["active", "trialing"]).optional().default("active"),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      return (
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
      );
   });

export const createMeter = createBillableProcedure("service.meter_created")
   .input(createMeterSchema)
   .handler(async ({ context, input }) => {
      const meter = (
         await createMeterRepo(context.db, context.teamId, input)
      ).match(
         (m) => m,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );

      context.scheduleEmit(() =>
         emitServiceMeterCreated(context.emit, context.emitCtx, {
            meterId: meter.id,
            eventName: meter.eventName,
         }),
      );

      return meter;
   });

export const createBenefit = createBillableProcedure("service.benefit_created")
   .input(createBenefitSchema)
   .handler(async ({ context, input }) => {
      const benefit = (
         await createBenefitRepo(context.db, context.teamId, input)
      ).match(
         (b) => b,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );

      context.scheduleEmit(() =>
         emitServiceBenefitCreated(context.emit, context.emitCtx, {
            benefitId: benefit.id,
            name: benefit.name,
         }),
      );

      return benefit;
   });

export const ingestUsage = createBillableProcedure("usage.ingested")
   .input(upsertUsageEventSchema)
   .handler(async ({ context, input }) => {
      if (input.teamId !== context.teamId) {
         throw WebAppError.forbidden(
            "Você não tem permissão para registrar uso neste time.",
         );
      }

      await enqueueUsageIngestionWorkflow(context.workflowClient, {
         teamId: input.teamId,
         meterId: input.meterId,
         quantity: input.quantity,
         idempotencyKey: input.idempotencyKey,
         contactId: input.contactId ?? undefined,
         properties: input.properties,
      });

      context.scheduleEmit(() =>
         emitUsageIngested(context.emit, context.emitCtx, {
            meterId: input.meterId,
            contactId: input.contactId ?? undefined,
            idempotencyKey: input.idempotencyKey,
         }),
      );

      return { queued: true };
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

export const getMeters = protectedProcedure.handler(async ({ context }) => {
   return (await listMeters(context.db, context.teamId)).match(
      (rows) => rows,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   );
});

export const getMeterById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
         await ensureMeterOwnership(context.db, input.id, context.teamId)
      ).match(
         (meter) => meter,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const updateMeterById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(updateMeterSchema))
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
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
         await ensureMeterOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteMeter(context.db, input.id))
      ).match(
         () => ({ success: true }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

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
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
         await ensureBenefitOwnership(context.db, input.id, context.teamId)
      ).match(
         (benefit) => benefit,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const updateBenefitById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(updateBenefitSchema))
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
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
         await ensureBenefitOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteBenefit(context.db, input.id))
      ).match(
         () => ({ success: true }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const attachBenefit = protectedProcedure
   .input(
      z.object({
         serviceId: z.string().uuid(),
         benefitId: z.string().uuid(),
      }),
   )
   .handler(async ({ context, input }) => {
      return (
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
         () => ({ success: true }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const detachBenefit = protectedProcedure
   .input(
      z.object({
         serviceId: z.string().uuid(),
         benefitId: z.string().uuid(),
      }),
   )
   .handler(async ({ context, input }) => {
      return (
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
         () => ({ success: true }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getServiceBenefits = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
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
      );
   });

export const getActiveCountByPrice = protectedProcedure
   .input(z.object({ priceId: z.string().uuid() }))
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
   .handler(async ({ context, input }) => {
      return (
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
      );
   });

export const updateItem = protectedProcedure
   .input(
      z.object({ id: z.string().uuid() }).merge(updateSubscriptionItemSchema),
   )
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
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
         await ensureSubscriptionItemOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => removeSubscriptionItem(context.db, input.id))
      ).match(
         () => ({ success: true }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const listItems = protectedProcedure
   .input(z.object({ subscriptionId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return (
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
      );
   });
