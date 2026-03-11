import { ORPCError } from "@orpc/server";
import {
   createService,
   createVariant as createVariantRepo,
   deleteService,
   deleteVariant,
   getService,
   getVariant,
   listServices,
   listVariantsByService,
   updateService,
   updateVariant as updateVariantRepo,
} from "@core/database/repositories/services-repository";
import {
   countActiveSubscriptionsByVariant,
   createSubscription as createSubscriptionRepo,
   getSubscription,
   listExpiringSoon,
   listSubscriptionsByContact,
   listSubscriptionsByTeam,
   updateSubscription,
} from "@core/database/repositories/subscriptions-repository";
import { contacts } from "@core/database/schemas/contacts";
import { services, serviceVariants } from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { getLogger } from "@core/logging/root";
import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const logger = getLogger().child({ module: "router:services" });

import {
   cancelPendingBillsForSubscription,
   generateBillsForSubscription,
} from "./services-bills";

const serviceSchema = createInsertSchema(services)
   .pick({
      name: true,
      description: true,
      basePrice: true,
      categoryId: true,
      tagId: true,
      isActive: true,
   })
   .extend({
      basePrice: z.string().default("0"),
   });

const variantSchema = createInsertSchema(serviceVariants).pick({
   name: true,
   basePrice: true,
   billingCycle: true,
   isActive: true,
});

const subscriptionSchema = createInsertSchema(contactSubscriptions).pick({
   contactId: true,
   variantId: true,
   startDate: true,
   endDate: true,
   negotiatedPrice: true,
   notes: true,
});

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
      const { teamId } = context;
      return listServices(teamId, input);
   });

export const create = protectedProcedure
   .input(serviceSchema)
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return createService(teamId, input);
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(serviceSchema.partial()))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const { id, ...data } = input;

      const service = await getService(id);
      if (!service || service.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Serviço não encontrado.",
         });
      }

      return updateService(id, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;

      const service = await getService(input.id);
      if (!service || service.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Serviço não encontrado.",
         });
      }

      await deleteService(input.id);
      return { success: true };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const { teamId } = context;
   return listServices(teamId);
});

export const getVariants = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;

      const service = await getService(input.serviceId);
      if (!service || service.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Serviço não encontrado.",
         });
      }

      return listVariantsByService(input.serviceId);
   });

export const createVariant = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }).merge(variantSchema))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const { serviceId, ...variantData } = input;

      const service = await getService(serviceId);
      if (!service || service.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Serviço não encontrado.",
         });
      }

      return createVariantRepo(teamId, serviceId, variantData);
   });

export const updateVariant = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(variantSchema.partial()))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const { id, ...data } = input;

      const variant = await getVariant(id);
      if (!variant || variant.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Variante não encontrada.",
         });
      }

      return updateVariantRepo(id, data);
   });

export const removeVariant = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;

      const variant = await getVariant(input.id);
      if (!variant || variant.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Variante não encontrada.",
         });
      }

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
      const { teamId } = context;
      return listSubscriptionsByTeam(teamId, input?.status);
   });

export const getContactSubscriptions = protectedProcedure
   .input(z.object({ contactId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const contact = await db
         .select({ teamId: contacts.teamId })
         .from(contacts)
         .where(eq(contacts.id, input.contactId));
      if (!contact[0] || contact[0].teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Contato não encontrado.",
         });
      }

      return listSubscriptionsByContact(input.contactId);
   });

export const createSubscription = protectedProcedure
   .input(subscriptionSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const contact = await db
         .select({ teamId: contacts.teamId })
         .from(contacts)
         .where(eq(contacts.id, input.contactId));
      if (!contact[0] || contact[0].teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Contato não encontrado.",
         });
      }

      const variant = await getVariant(input.variantId);
      if (!variant || variant.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Variante não encontrada.",
         });
      }

      const sub = await createSubscriptionRepo(teamId, {
         ...input,
         source: "manual",
         cancelAtPeriodEnd: false,
      });

      try {
         const service = await getService(variant.serviceId);
         if (service) {
            await generateBillsForSubscription(db, sub, variant, service.name);
         }
      } catch (err) {
         logger.error({ err }, "Failed to generate bills for subscription");
      }

      return sub;
   });

export const cancelSubscription = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const subscription = await getSubscription(input.id);
      if (!subscription || subscription.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Assinatura não encontrada.",
         });
      }

      if (subscription.status !== "active") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Apenas assinaturas ativas podem ser canceladas.",
         });
      }

      if (subscription.source === "asaas") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Assinaturas do Asaas não podem ser canceladas aqui.",
         });
      }

      const cancelled = await updateSubscription(input.id, {
         status: "cancelled",
      });

      await cancelPendingBillsForSubscription(db, input.id).catch((err) => {
         logger.error({ err }, "Failed to cancel pending bills");
      });

      return cancelled;
   });

export const getExpiringSoon = protectedProcedure.handler(
   async ({ context }) => {
      const { teamId } = context;
      return listExpiringSoon(teamId);
   },
);

export const getActiveCountByVariant = protectedProcedure.handler(
   async ({ context }) => {
      const { teamId } = context;
      return countActiveSubscriptionsByVariant(teamId);
   },
);
