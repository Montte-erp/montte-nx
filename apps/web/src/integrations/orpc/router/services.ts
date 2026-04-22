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
      return listServices(context.db, context.teamId, input);
   });

export const create = protectedProcedure
   .input(createServiceSchema)
   .handler(async ({ context, input }) => {
      return createService(context.db, context.teamId, input);
   });

export const bulkCreate = protectedProcedure
   .input(z.object({ items: z.array(createServiceSchema).min(1) }))
   .handler(async ({ context, input }) => {
      const inserted = await bulkCreateServices(
         context.db,
         context.teamId,
         input.items,
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
      await ensureServiceOwnership(context.db, input.id, context.teamId);
      const { id, ...data } = input;
      return updateService(context.db, id, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureServiceOwnership(context.db, input.id, context.teamId);
      await deleteService(context.db, input.id);
      return { success: true };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   return listServices(context.db, context.teamId);
});

export const getVariants = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureServiceOwnership(context.db, input.serviceId, context.teamId);
      return listVariantsByService(context.db, input.serviceId);
   });

export const createVariant = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }).merge(createVariantSchema))
   .handler(async ({ context, input }) => {
      await ensureServiceOwnership(context.db, input.serviceId, context.teamId);
      const { serviceId, ...variantData } = input;
      return createVariantRepo(
         context.db,
         context.teamId,
         serviceId,
         variantData,
      );
   });

export const updateVariant = protectedProcedure
   .input(idSchema.merge(updateVariantSchema))
   .handler(async ({ context, input }) => {
      await ensureVariantOwnership(context.db, input.id, context.teamId);
      const { id, ...data } = input;
      return updateVariantRepo(context.db, id, data);
   });

export const removeVariant = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureVariantOwnership(context.db, input.id, context.teamId);
      await deleteVariant(context.db, input.id);
      return { success: true };
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
      return listSubscriptionsByTeam(context.db, context.teamId, input?.status);
   });

export const getContactSubscriptions = protectedProcedure
   .input(z.object({ contactId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureContactOwnership(context.db, input.contactId, context.teamId);
      return listSubscriptionsByContact(context.db, input.contactId);
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
      await ensureContactOwnership(context.db, input.contactId, context.teamId);
      await ensureVariantOwnership(context.db, input.variantId, context.teamId);

      const sub = await createSubscriptionRepo(context.db, context.teamId, {
         ...input,
         source: "manual",
         cancelAtPeriodEnd: false,
      });

      return sub;
   });

export const cancelSubscription = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const subscription = await ensureSubscriptionOwnership(
         context.db,
         input.id,
         context.teamId,
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

      const cancelled = await updateSubscription(context.db, input.id, {
         status: "cancelled",
      });

      return cancelled;
   });

export const getExpiringSoon = protectedProcedure.handler(
   async ({ context }) => {
      return listExpiringSoon(context.db, context.teamId);
   },
);

export const getActiveCountByVariant = protectedProcedure.handler(
   async ({ context }) => {
      return countActiveSubscriptionsByVariant(context.db, context.teamId);
   },
);
