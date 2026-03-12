import { ensureContactOwnership } from "@core/database/repositories/contacts-repository";
import {
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
import { AppError } from "@core/logging/errors";
import { getLogger } from "@core/logging/root";
import { z } from "zod";
import { protectedProcedure } from "../server";
import {
   cancelPendingBillsForSubscription,
   generateBillsForSubscription,
} from "./services-bills";

const logger = getLogger().child({ module: "router:services" });

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
      return listServices(context.teamId, input);
   });

export const create = protectedProcedure
   .input(createServiceSchema)
   .handler(async ({ context, input }) => {
      return createService(context.teamId, input);
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateServiceSchema))
   .handler(async ({ context, input }) => {
      await ensureServiceOwnership(input.id, context.teamId);
      const { id, ...data } = input;
      return updateService(id, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureServiceOwnership(input.id, context.teamId);
      await deleteService(input.id);
      return { success: true };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   return listServices(context.teamId);
});

export const getVariants = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureServiceOwnership(input.serviceId, context.teamId);
      return listVariantsByService(input.serviceId);
   });

export const createVariant = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }).merge(createVariantSchema))
   .handler(async ({ context, input }) => {
      await ensureServiceOwnership(input.serviceId, context.teamId);
      const { serviceId, ...variantData } = input;
      return createVariantRepo(context.teamId, serviceId, variantData);
   });

export const updateVariant = protectedProcedure
   .input(idSchema.merge(updateVariantSchema))
   .handler(async ({ context, input }) => {
      await ensureVariantOwnership(input.id, context.teamId);
      const { id, ...data } = input;
      return updateVariantRepo(id, data);
   });

export const removeVariant = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureVariantOwnership(input.id, context.teamId);
      await deleteVariant(input.id);
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
      return listSubscriptionsByTeam(context.teamId, input?.status);
   });

export const getContactSubscriptions = protectedProcedure
   .input(z.object({ contactId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureContactOwnership(input.contactId, context.teamId);
      return listSubscriptionsByContact(input.contactId);
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
      await ensureContactOwnership(input.contactId, context.teamId);
      const variant = await ensureVariantOwnership(
         input.variantId,
         context.teamId,
      );

      const sub = await createSubscriptionRepo(context.teamId, {
         ...input,
         source: "manual",
         cancelAtPeriodEnd: false,
      });

      try {
         const service = await ensureServiceOwnership(
            variant.serviceId,
            context.teamId,
         );
         await generateBillsForSubscription(sub, variant, service.name);
      } catch (err) {
         logger.error({ err }, "Failed to generate bills for subscription");
      }

      return sub;
   });

export const cancelSubscription = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const subscription = await ensureSubscriptionOwnership(
         input.id,
         context.teamId,
      );

      if (subscription.status !== "active") {
         throw AppError.validation(
            "Apenas assinaturas ativas podem ser canceladas.",
         );
      }

      if (subscription.source === "asaas") {
         throw AppError.validation(
            "Assinaturas do Asaas não podem ser canceladas aqui.",
         );
      }

      const cancelled = await updateSubscription(input.id, {
         status: "cancelled",
      });

      await cancelPendingBillsForSubscription(input.id).catch((err) => {
         logger.error({ err }, "Failed to cancel pending bills");
      });

      return cancelled;
   });

export const getExpiringSoon = protectedProcedure.handler(
   async ({ context }) => {
      return listExpiringSoon(context.teamId);
   },
);

export const getActiveCountByVariant = protectedProcedure.handler(
   async ({ context }) => {
      return countActiveSubscriptionsByVariant(context.teamId);
   },
);
