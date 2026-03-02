import { ORPCError } from "@orpc/server";
import {
   countActiveSubscriptionsByVariant,
   createService,
   createSubscription as createSubscriptionRepo,
   createVariant as createVariantRepo,
   deleteService,
   deleteVariant,
   getService,
   getSubscription,
   getVariant,
   listExpiringSoon,
   listServices,
   listSubscriptionsByContact,
   listSubscriptionsByTeam,
   listVariantsByService,
   updateService,
   updateSubscription,
   updateVariant as updateVariantRepo,
} from "@packages/database/repositories/services-repository";
import { contacts } from "@packages/database/schemas/contacts";
import {
   contactSubscriptions,
   services,
   serviceVariants,
} from "@packages/database/schemas/services";
import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const serviceSchema = createInsertSchema(services).pick({
   name: true,
   description: true,
   category: true,
   isActive: true,
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

// =============================================================================
// Service Procedures
// =============================================================================

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listServices(db, teamId);
});

export const create = protectedProcedure
   .input(serviceSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createService(db, { ...input, teamId });
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(serviceSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { id, ...data } = input;

      const service = await getService(db, id);
      if (!service || service.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Serviço não encontrado.",
         });
      }

      return updateService(db, id, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const service = await getService(db, input.id);
      if (!service || service.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Serviço não encontrado.",
         });
      }

      await deleteService(db, input.id);
      return { success: true };
   });

// =============================================================================
// Variant Procedures
// =============================================================================

export const getVariants = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const service = await getService(db, input.serviceId);
      if (!service || service.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Serviço não encontrado.",
         });
      }

      return listVariantsByService(db, input.serviceId);
   });

export const createVariant = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }).merge(variantSchema))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { serviceId, ...variantData } = input;

      const service = await getService(db, serviceId);
      if (!service || service.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Serviço não encontrado.",
         });
      }

      return createVariantRepo(db, { ...variantData, serviceId, teamId });
   });

export const updateVariant = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(variantSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { id, ...data } = input;

      const variant = await getVariant(db, id);
      if (!variant || variant.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Variante não encontrada.",
         });
      }

      return updateVariantRepo(db, id, data);
   });

export const removeVariant = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const variant = await getVariant(db, input.id);
      if (!variant || variant.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Variante não encontrada.",
         });
      }

      await deleteVariant(db, input.id);
      return { success: true };
   });

// =============================================================================
// Subscription Procedures
// =============================================================================

export const getAllSubscriptions = protectedProcedure
   .input(
      z
         .object({
            status: z.enum(["active", "completed", "cancelled"]).optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return listSubscriptionsByTeam(db, teamId, input?.status);
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

      return listSubscriptionsByContact(db, input.contactId);
   });

export const createSubscription = protectedProcedure
   .input(subscriptionSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      // Verify contact belongs to team
      const contact = await db
         .select({ teamId: contacts.teamId })
         .from(contacts)
         .where(eq(contacts.id, input.contactId));
      if (!contact[0] || contact[0].teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Contato não encontrado.",
         });
      }

      // Verify variant belongs to team
      const variant = await getVariant(db, input.variantId);
      if (!variant || variant.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Variante não encontrada.",
         });
      }

      // TODO Task 7: call generateBillsForSubscription here
      return createSubscriptionRepo(db, {
         ...input,
         teamId,
         source: "manual",
      });
   });

export const cancelSubscription = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const subscription = await getSubscription(db, input.id);
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

      // TODO Task 7: cancel pending bills here
      return updateSubscription(db, input.id, { status: "cancelled" });
   });

// =============================================================================
// Analytics Procedures
// =============================================================================

export const getExpiringSoon = protectedProcedure.handler(
   async ({ context }) => {
      const { db, teamId } = context;
      return listExpiringSoon(db, teamId);
   },
);

export const getActiveCountByVariant = protectedProcedure.handler(
   async ({ context }) => {
      const { db, teamId } = context;
      return countActiveSubscriptionsByVariant(db, teamId);
   },
);
