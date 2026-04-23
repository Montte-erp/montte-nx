import { ensureContactOwnership } from "@core/database/repositories/contacts-repository";
import {
   bulkCreateServices,
   createService,
   createVariant as createVariantRepo,
   deleteService,
   deleteVariant,
   ensureServiceOwnership,
   ensureVariantOwnership,
   listServices,
   listVariantsByService,
   updateService,
   updateVariant as updateVariantRepo,
} from "@core/database/repositories/services-repository";
import {
   countActiveSubscriptionsByVariant,
   createSubscription as createSubscriptionRepo,
   ensureSubscriptionOwnership,
   listExpiringSoon,
   listSubscriptionsByContact,
   listSubscriptionsByTeam,
   updateSubscription,
} from "@core/database/repositories/subscriptions-repository";
import {
   createServiceSchema,
   updateServiceSchema,
   createVariantSchema,
   updateVariantSchema,
} from "@core/database/schemas/services";
import { createSubscriptionSchema } from "@core/database/schemas/subscriptions";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
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

export const createSubscription = protectedProcedure
   .input(
      createSubscriptionSchema.pick({
         contactId: true,
         variantId: true,
         startDate: true,
         endDate: true,
         negotiatedPrice: true,
         notes: true,
      }),
   )
   .handler(async ({ context, input }) => {
      return (
         await ensureContactOwnership(
            context.db,
            input.contactId,
            context.teamId,
         )
            .andThen(() =>
               ensureVariantOwnership(
                  context.db,
                  input.variantId,
                  context.teamId,
               ),
            )
            .andThen(() =>
               createSubscriptionRepo(context.db, context.teamId, {
                  ...input,
                  source: "manual",
                  cancelAtPeriodEnd: false,
               }),
            )
      ).match(
         (sub) => sub,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
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

      if (subscription.status !== "active") {
         throw WebAppError.badRequest(
            "Apenas assinaturas ativas podem ser canceladas.",
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

export const getExpiringSoon = protectedProcedure.handler(
   async ({ context }) => {
      return (await listExpiringSoon(context.db, context.teamId)).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   },
);

export const getActiveCountByVariant = protectedProcedure.handler(
   async ({ context }) => {
      return (
         await countActiveSubscriptionsByVariant(context.db, context.teamId)
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   },
);
