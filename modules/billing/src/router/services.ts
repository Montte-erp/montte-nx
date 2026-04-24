import dayjs from "dayjs";
import { and, asc, count, eq, sql, sum } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { meters } from "@core/database/schemas/meters";
import { services, servicePrices } from "@core/database/schemas/services";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { usageEvents } from "@core/database/schemas/usage-events";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure, billableProcedure } from "@core/orpc/server";
import { enqueueBenefitLifecycleWorkflow } from "../workflows/benefit-lifecycle-workflow";
import { enqueueTrialExpiryWorkflow } from "../workflows/trial-expiry-workflow";
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

const MAX_ITEMS_PER_SUBSCRIPTION = 20;

// --- Ownership middleware builders ---

const updateServiceProcedure = protectedProcedure
   .input(updateServiceInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (service) =>
            service?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Serviço não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const serviceByIdProcedure = protectedProcedure
   .input(idInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (service) =>
            service?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Serviço não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const serviceByServiceIdProcedure = protectedProcedure
   .input(serviceIdInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, input.serviceId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (service) =>
            service?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Serviço não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const createVariantProcedure = protectedProcedure
   .input(createPriceForServiceInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, input.serviceId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (service) =>
            service?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Serviço não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const updateVariantProcedure = protectedProcedure
   .input(updatePriceInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.servicePrices.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (price) =>
            price?.teamId === context.teamId
               ? next({})
               : Promise.reject(WebAppError.notFound("Preço não encontrado.")),
         (e) => Promise.reject(e),
      ),
   );

const variantByIdProcedure = protectedProcedure
   .input(idInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.servicePrices.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (price) =>
            price?.teamId === context.teamId
               ? next({})
               : Promise.reject(WebAppError.notFound("Preço não encontrado.")),
         (e) => Promise.reject(e),
      ),
   );

const contactSubscriptionsProcedure = protectedProcedure
   .input(contactIdInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.contacts.findFirst({
            where: (f, { eq }) => eq(f.id, input.contactId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (contact) =>
            contact?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Contato não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const createSubscriptionProcedure = billableProcedure
   .input(createSubscriptionWithItemsInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.contacts.findFirst({
            where: (f, { eq }) => eq(f.id, input.contactId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (contact) =>
            contact?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Contato não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const updateMeterProcedure = protectedProcedure
   .input(updateMeterInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.meters.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (meter) =>
            meter?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Medidor não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const meterByIdProcedure = protectedProcedure
   .input(idInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.meters.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (meter) =>
            meter?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Medidor não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const updateBenefitProcedure = protectedProcedure
   .input(updateBenefitInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.benefits.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (benefit) =>
            benefit?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Benefício não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const benefitByIdProcedure = protectedProcedure
   .input(idInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.benefits.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (benefit) =>
            benefit?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Benefício não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const attachBenefitProcedure = protectedProcedure
   .input(serviceBenefitLinkSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, input.serviceId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (service) =>
            service?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Serviço não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   )
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.benefits.findFirst({
            where: (f, { eq }) => eq(f.id, input.benefitId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (benefit) =>
            benefit?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Benefício não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const detachBenefitProcedure = protectedProcedure
   .input(serviceBenefitLinkSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, input.serviceId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (service) =>
            service?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Serviço não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const addItemProcedure = protectedProcedure
   .input(createSubscriptionItemSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.contactSubscriptions.findFirst({
            where: (f, { eq }) => eq(f.id, input.subscriptionId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (sub) =>
            sub?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Assinatura não encontrada."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const updateItemProcedure = protectedProcedure
   .input(updateSubscriptionItemInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.subscriptionItems.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (item) =>
            item?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Item de assinatura não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const subscriptionItemByIdProcedure = protectedProcedure
   .input(idInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.subscriptionItems.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (item) =>
            item?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Item de assinatura não encontrado."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

const listItemsProcedure = protectedProcedure
   .input(subscriptionIdInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.contactSubscriptions.findFirst({
            where: (f, { eq }) => eq(f.id, input.subscriptionId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (sub) =>
            sub?.teamId === context.teamId
               ? next({})
               : Promise.reject(
                    WebAppError.notFound("Assinatura não encontrada."),
                 ),
         (e) => Promise.reject(e),
      ),
   );

// --- Handlers ---

export const getAll = protectedProcedure
   .input(listServicesInputSchema)
   .handler(async ({ context, input }) =>
      (
         await fromPromise(
            context.db.query.services.findMany({
               where: (f, { eq, and, or, ilike }) => {
                  const conditions = [eq(f.teamId, context.teamId)];
                  if (input?.search) {
                     const pattern = `%${input.search}%`;
                     conditions.push(
                        or(
                           ilike(f.name, pattern),
                           ilike(f.description, pattern),
                        )!,
                     );
                  }
                  if (input?.categoryId)
                     conditions.push(eq(f.categoryId, input.categoryId));
                  return and(...conditions);
               },
               with: { category: true, tag: true },
               orderBy: (f, { asc }) => [asc(f.name)],
            }),
            () => WebAppError.internal("Falha ao listar serviços."),
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw e;
         },
      ),
   );

export const create = protectedProcedure
   .input(createServiceSchema)
   .handler(async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(services)
                  .values({ ...input, teamId: context.teamId })
                  .returning();
               if (!row) throw WebAppError.internal("Falha ao criar serviço.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao criar serviço."),
         )
      ).match(
         (service) => service,
         (e) => {
            throw e;
         },
      ),
   );

export const bulkCreate = protectedProcedure
   .input(bulkCreateServicesInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const rows = await tx
               .insert(services)
               .values(
                  input.items.map((item) => ({
                     ...item,
                     teamId: context.teamId,
                  })),
               )
               .returning();
            return rows;
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao importar serviços."),
      );
      const inserted = result.match(
         (rows) => rows,
         (e) => {
            throw e;
         },
      );
      if (inserted.length === 0)
         throw WebAppError.internal("Falha ao importar os serviços.");
      return inserted;
   });

export const update = updateServiceProcedure.handler(
   async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(services)
                  .set(data)
                  .where(eq(services.id, id))
                  .returning();
               if (!row) throw WebAppError.notFound("Serviço não encontrado.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao atualizar serviço."),
         )
      ).match(
         (service) => service,
         (e) => {
            throw e;
         },
      );
   },
);

export const remove = serviceByIdProcedure.handler(async ({ context, input }) =>
   (
      await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(services).where(eq(services.id, input.id));
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao excluir serviço."),
      )
   ).match(
      () => ({ success: true as const }),
      (e) => {
         throw e;
      },
   ),
);

export const exportAll = protectedProcedure.handler(async ({ context }) =>
   (
      await fromPromise(
         context.db.query.services.findMany({
            where: (f, { eq }) => eq(f.teamId, context.teamId),
            with: { category: true, tag: true },
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
         () => WebAppError.internal("Falha ao listar serviços."),
      )
   ).match(
      (rows) => rows,
      (e) => {
         throw e;
      },
   ),
);

export const getVariants = serviceByServiceIdProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.query.servicePrices.findMany({
               where: (f, { eq }) => eq(f.serviceId, input.serviceId),
               orderBy: (f, { asc }) => [asc(f.name)],
            }),
            () => WebAppError.internal("Falha ao listar preços."),
         )
      ).match(
         (variants) => variants,
         (e) => {
            throw e;
         },
      ),
);

export const createVariant = createVariantProcedure.handler(
   async ({ context, input }) => {
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
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(servicePrices)
                  .values({ ...variantData, teamId: context.teamId, serviceId })
                  .returning();
               if (!row) throw WebAppError.internal("Falha ao criar preço.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao criar preço."),
         )
      ).match(
         (variant) => variant,
         (e) => {
            throw e;
         },
      );
   },
);

export const updateVariant = updateVariantProcedure.handler(
   async ({ context, input }) => {
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
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(servicePrices)
                  .set(data)
                  .where(eq(servicePrices.id, id))
                  .returning();
               if (!row) throw WebAppError.notFound("Preço não encontrado.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao atualizar preço."),
         )
      ).match(
         (variant) => variant,
         (e) => {
            throw e;
         },
      );
   },
);

export const removeVariant = variantByIdProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .delete(servicePrices)
                  .where(eq(servicePrices.id, input.id));
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao excluir preço."),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw e;
         },
      ),
);

export const getAllSubscriptions = protectedProcedure
   .input(listSubscriptionsInputSchema)
   .handler(async ({ context, input }) =>
      (
         await fromPromise(
            context.db.query.contactSubscriptions.findMany({
               where: (f, { eq, and }) =>
                  input?.status
                     ? and(
                          eq(f.teamId, context.teamId),
                          eq(f.status, input.status),
                       )
                     : eq(f.teamId, context.teamId),
            }),
            () => WebAppError.internal("Falha ao listar assinaturas."),
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw e;
         },
      ),
   );

export const getContactSubscriptions = contactSubscriptionsProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.query.contactSubscriptions.findMany({
               where: (f, { eq }) => eq(f.contactId, input.contactId),
               orderBy: (f, { desc }) => [desc(f.createdAt)],
            }),
            () =>
               WebAppError.internal("Falha ao listar assinaturas do contato."),
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw e;
         },
      ),
);

export const createSubscription = createSubscriptionProcedure.handler(
   async ({ context, input }) => {
      const sub = (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const { items, ...subscriptionData } = input;
               const [row] = await tx
                  .insert(contactSubscriptions)
                  .values({
                     ...subscriptionData,
                     teamId: context.teamId,
                     source: "manual",
                     cancelAtPeriodEnd: false,
                  })
                  .returning();
               if (!row)
                  throw WebAppError.internal("Falha ao criar assinatura.");

               if (items && items.length > 0) {
                  const results = await Promise.allSettled(
                     items.map((item) =>
                        tx
                           .insert(subscriptionItems)
                           .values({
                              ...item,
                              subscriptionId: row.id,
                              teamId: context.teamId,
                           })
                           .returning(),
                     ),
                  );
                  if (results.some((r) => r.status === "rejected"))
                     throw WebAppError.internal(
                        "Falha ao adicionar itens à assinatura.",
                     );
               }

               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao criar assinatura."),
         )
      ).match(
         (row) => row,
         (e) => {
            throw e;
         },
      );

      if (sub.status === "trialing" && sub.trialEndsAt) {
         void fromPromise(
            enqueueTrialExpiryWorkflow(context.workflowClient, {
               teamId: sub.teamId,
               subscriptionId: sub.id,
               trialEndsAt: sub.trialEndsAt.toISOString(),
               operatorEmail: context.session.user.email,
            }),
            () =>
               WebAppError.internal("Falha ao enfileirar workflow de trial."),
         ).match(
            () => {},
            (e) => {
               throw e;
            },
         );
      } else if (input.items?.length) {
         const price = await context.db.query.servicePrices.findFirst({
            where: (f, { eq }) => eq(f.id, input.items![0].priceId),
         });
         if (price) {
            void fromPromise(
               enqueueBenefitLifecycleWorkflow(context.workflowClient, {
                  teamId: sub.teamId,
                  subscriptionId: sub.id,
                  serviceId: price.serviceId,
                  newStatus: sub.status,
               }),
               () =>
                  WebAppError.internal(
                     "Falha ao enfileirar workflow de benefícios.",
                  ),
            ).match(
               () => {},
               (e) => {
                  throw e;
               },
            );
         }
      }

      return sub;
   },
);

export const cancelSubscription = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) => {
      const subscription = (
         await fromPromise(
            context.db.query.contactSubscriptions.findFirst({
               where: (f, { eq }) => eq(f.id, input.id),
            }),
            () => WebAppError.internal("Falha ao buscar assinatura."),
         )
      ).match(
         (sub) => {
            if (!sub || sub.teamId !== context.teamId)
               throw WebAppError.notFound("Assinatura não encontrada.");
            return sub;
         },
         (e) => {
            throw e;
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

      const cancelled = (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [updated] = await tx
                  .update(contactSubscriptions)
                  .set({ status: "cancelled", updatedAt: dayjs().toDate() })
                  .where(eq(contactSubscriptions.id, input.id))
                  .returning();
               if (!updated)
                  throw WebAppError.notFound("Assinatura não encontrada.");
               return updated;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao cancelar assinatura."),
         )
      ).match(
         (row) => row,
         (e) => {
            throw e;
         },
      );

      const firstItem = await context.db.query.subscriptionItems.findFirst({
         where: (f, { eq }) => eq(f.subscriptionId, cancelled.id),
         with: { price: true },
      });

      if (firstItem?.price) {
         void fromPromise(
            enqueueBenefitLifecycleWorkflow(context.workflowClient, {
               teamId: cancelled.teamId,
               subscriptionId: cancelled.id,
               serviceId: firstItem.price.serviceId,
               newStatus: "cancelled",
               previousStatus: subscription.status,
            }),
            () =>
               WebAppError.internal(
                  "Falha ao enfileirar workflow de benefícios.",
               ),
         ).match(
            () => {},
            (e) => {
               throw e;
            },
         );
      }

      return cancelled;
   });

export const getExpiringSoon = protectedProcedure
   .input(listExpiringSoonInputSchema)
   .handler(async ({ context, input }) => {
      const now = dayjs().format("YYYY-MM-DD");
      const futureDate = dayjs().add(30, "day").format("YYYY-MM-DD");
      return (
         await fromPromise(
            context.db.query.contactSubscriptions.findMany({
               where: (f, { eq, and, gte, lte }) =>
                  and(
                     eq(f.teamId, context.teamId),
                     eq(f.status, input?.status ?? "active"),
                     gte(f.endDate, now),
                     lte(f.endDate, futureDate),
                  ),
            }),
            () =>
               WebAppError.internal("Falha ao listar assinaturas expirando."),
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw e;
         },
      );
   });

export const createMeter = billableProcedure
   .input(createMeterSchema)
   .handler(async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(meters)
                  .values({ ...input, teamId: context.teamId })
                  .returning();
               if (!row) throw WebAppError.internal("Falha ao criar medidor.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao criar medidor."),
         )
      ).match(
         (meter) => meter,
         (e) => {
            throw e;
         },
      ),
   );

export const createBenefit = billableProcedure
   .input(createBenefitSchema)
   .handler(async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(benefits)
                  .values({ ...input, teamId: context.teamId })
                  .returning();
               if (!row)
                  throw WebAppError.internal("Falha ao criar benefício.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao criar benefício."),
         )
      ).match(
         (benefit) => benefit,
         (e) => {
            throw e;
         },
      ),
   );

export const ingestUsage = billableProcedure
   .input(upsertUsageEventSchema)
   .handler(async ({ context, input }) => {
      if (input.teamId !== context.teamId)
         throw WebAppError.forbidden(
            "Você não tem permissão para registrar uso neste time.",
         );

      return (
         await fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .insert(usageEvents)
                  .values({
                     teamId: input.teamId,
                     meterId: input.meterId,
                     quantity: input.quantity,
                     idempotencyKey: input.idempotencyKey,
                     contactId: input.contactId,
                     properties: input.properties ?? {},
                  })
                  .onConflictDoNothing({
                     target: [usageEvents.teamId, usageEvents.idempotencyKey],
                  });
            }),
            () => WebAppError.internal("Falha ao registrar evento de uso."),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw e;
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
   (
      await fromPromise(
         context.db.query.meters.findMany({
            where: (f, { eq }) => eq(f.teamId, context.teamId),
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
         () => WebAppError.internal("Falha ao listar medidores."),
      )
   ).match(
      (rows) => rows,
      (e) => {
         throw e;
      },
   ),
);

export const getMeterById = protectedProcedure
   .input(idInputSchema)
   .handler(async ({ context, input }) =>
      (
         await fromPromise(
            context.db.query.meters.findFirst({
               where: (f, { eq }) => eq(f.id, input.id),
            }),
            () => WebAppError.internal("Falha ao buscar medidor."),
         )
      ).match(
         (meter) => {
            if (!meter || meter.teamId !== context.teamId)
               throw WebAppError.notFound("Medidor não encontrado.");
            return meter;
         },
         (e) => {
            throw e;
         },
      ),
   );

export const updateMeterById = updateMeterProcedure.handler(
   async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(meters)
                  .set(data)
                  .where(eq(meters.id, id))
                  .returning();
               if (!row) throw WebAppError.notFound("Medidor não encontrado.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao atualizar medidor."),
         )
      ).match(
         (meter) => meter,
         (e) => {
            throw e;
         },
      );
   },
);

export const removeMeter = meterByIdProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               await tx.delete(meters).where(eq(meters.id, input.id));
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao excluir medidor."),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw e;
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
         await fromPromise(
            context.db.query.benefits.findFirst({
               where: (f, { eq }) => eq(f.id, input.id),
            }),
            () => WebAppError.internal("Falha ao buscar benefício."),
         )
      ).match(
         (benefit) => {
            if (!benefit || benefit.teamId !== context.teamId)
               throw WebAppError.notFound("Benefício não encontrado.");
            return benefit;
         },
         (e) => {
            throw e;
         },
      ),
   );

export const updateBenefitById = updateBenefitProcedure.handler(
   async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(benefits)
                  .set(data)
                  .where(eq(benefits.id, id))
                  .returning();
               if (!row)
                  throw WebAppError.notFound("Benefício não encontrado.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao atualizar benefício."),
         )
      ).match(
         (benefit) => benefit,
         (e) => {
            throw e;
         },
      );
   },
);

export const removeBenefit = benefitByIdProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               await tx.delete(benefits).where(eq(benefits.id, input.id));
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao excluir benefício."),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw e;
         },
      ),
);

export const attachBenefit = attachBenefitProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .insert(serviceBenefits)
                  .values({
                     serviceId: input.serviceId,
                     benefitId: input.benefitId,
                  })
                  .onConflictDoNothing();
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal(
                       "Falha ao associar benefício ao serviço.",
                    ),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw e;
         },
      ),
);

export const detachBenefit = detachBenefitProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .delete(serviceBenefits)
                  .where(
                     and(
                        eq(serviceBenefits.serviceId, input.serviceId),
                        eq(serviceBenefits.benefitId, input.benefitId),
                     ),
                  );
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal(
                       "Falha ao remover benefício do serviço.",
                    ),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw e;
         },
      ),
);

export const getServiceBenefits = serviceByServiceIdProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.query.serviceBenefits.findMany({
               where: (f, { eq }) => eq(f.serviceId, input.serviceId),
               with: { benefit: true },
            }),
            () =>
               WebAppError.internal("Falha ao listar benefícios do serviço."),
         )
      ).match(
         (rows) => rows.map((r) => r.benefit),
         (e) => {
            throw e;
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

export const addItem = addItemProcedure.handler(async ({ context, input }) =>
   (
      await fromPromise(
         context.db.transaction(async (tx) => {
            const lock = await tx.execute(
               sql`SELECT id FROM crm.contact_subscriptions WHERE id = ${input.subscriptionId} AND team_id = ${context.teamId} FOR UPDATE`,
            );
            if (lock.rows.length === 0)
               throw WebAppError.notFound("Assinatura não encontrada.");

            const [countRow] = await tx
               .select({ itemCount: count() })
               .from(subscriptionItems)
               .where(
                  eq(subscriptionItems.subscriptionId, input.subscriptionId),
               );
            if ((countRow?.itemCount ?? 0) >= MAX_ITEMS_PER_SUBSCRIPTION)
               throw WebAppError.badRequest(
                  `Limite de ${MAX_ITEMS_PER_SUBSCRIPTION} itens por assinatura atingido.`,
               );

            const [row] = await tx
               .insert(subscriptionItems)
               .values({ ...input, teamId: context.teamId })
               .returning();
            if (!row) throw WebAppError.internal("Falha ao adicionar item.");
            return row;
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao adicionar item."),
      )
   ).match(
      (item) => item,
      (e) => {
         throw e;
      },
   ),
);

export const updateItem = updateItemProcedure.handler(
   async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(subscriptionItems)
                  .set(data)
                  .where(eq(subscriptionItems.id, id))
                  .returning();
               if (!row)
                  throw WebAppError.notFound(
                     "Item de assinatura não encontrado.",
                  );
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao atualizar item."),
         )
      ).match(
         (item) => item,
         (e) => {
            throw e;
         },
      );
   },
);

export const removeItem = subscriptionItemByIdProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .delete(subscriptionItems)
                  .where(eq(subscriptionItems.id, input.id));
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao remover item."),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw e;
         },
      ),
);

export const listItems = listItemsProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.query.subscriptionItems.findMany({
               where: (f, { eq }) => eq(f.subscriptionId, input.subscriptionId),
               orderBy: (f, { asc }) => [asc(f.createdAt)],
            }),
            () => WebAppError.internal("Falha ao listar itens da assinatura."),
         )
      ).match(
         (items) => items,
         (e) => {
            throw e;
         },
      ),
);
