import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
   services,
   servicePrices,
   pricingTypeEnum,
} from "@core/database/schemas/services";
import { billingCycleEnum } from "@core/database/schemas/subscriptions";
import { meters, meterAggregationEnum } from "@core/database/schemas/meters";
import { benefits, benefitTypeEnum } from "@core/database/schemas/benefits";

const nameSchema = z
   .string()
   .min(1, "Nome é obrigatório.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Preço deve ser um número válido maior ou igual a zero.",
   });

// --- Services ---

export const createServiceSchema = createInsertSchema(services)
   .pick({ name: true, description: true, categoryId: true, tagId: true })
   .extend({
      name: nameSchema,
      description: z.string().max(500).nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      tagId: z.string().uuid().nullable().optional(),
   });

export const updateServiceSchema = createInsertSchema(services)
   .pick({
      name: true,
      description: true,
      categoryId: true,
      tagId: true,
      isActive: true,
   })
   .extend({
      name: nameSchema.optional(),
      description: z.string().max(500).nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      tagId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
   })
   .partial();

// --- Prices ---

export const createPriceSchema = createInsertSchema(servicePrices)
   .pick({
      name: true,
      type: true,
      basePrice: true,
      interval: true,
      meterId: true,
      priceCap: true,
      trialDays: true,
      autoEnroll: true,
   })
   .extend({
      name: nameSchema,
      type: z.enum(pricingTypeEnum.enumValues).default("flat"),
      basePrice: priceSchema,
      interval: z.enum(billingCycleEnum.enumValues),
      meterId: z.string().uuid().nullable().optional(),
      priceCap: priceSchema.nullable().optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
      autoEnroll: z.boolean().default(false),
   });

export const updatePriceSchema = createInsertSchema(servicePrices)
   .pick({
      name: true,
      type: true,
      basePrice: true,
      interval: true,
      meterId: true,
      isActive: true,
      priceCap: true,
      trialDays: true,
   })
   .extend({
      name: nameSchema.optional(),
      type: z.enum(pricingTypeEnum.enumValues).optional(),
      basePrice: priceSchema.optional(),
      interval: z.enum(billingCycleEnum.enumValues).optional(),
      meterId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
      priceCap: priceSchema.nullable().optional(),
      trialDays: z.number().int().min(0).nullable().optional(),
   })
   .partial();

// --- Meters ---

export const createMeterSchema = createInsertSchema(meters)
   .pick({
      name: true,
      eventName: true,
      aggregation: true,
      aggregationProperty: true,
      filters: true,
   })
   .extend({
      name: nameSchema,
      eventName: z.string().min(1, "Nome do evento é obrigatório."),
      aggregation: z.enum(meterAggregationEnum.enumValues).default("sum"),
      aggregationProperty: z.string().nullable().optional(),
      filters: z.record(z.string(), z.unknown()).optional().default({}),
   });

export const updateMeterSchema = z.object({
   name: nameSchema.optional(),
   isActive: z.boolean().optional(),
});

// --- Benefits ---

export const createBenefitSchema = createInsertSchema(benefits)
   .pick({
      name: true,
      type: true,
      meterId: true,
      creditAmount: true,
      description: true,
   })
   .extend({
      name: nameSchema,
      type: z.enum(benefitTypeEnum.enumValues),
      meterId: z.string().uuid().nullable().optional(),
      creditAmount: z.number().int().min(1).nullable().optional(),
      description: z.string().max(500).nullable().optional(),
   });

export const updateBenefitSchema = z.object({
   name: nameSchema.optional(),
   description: z.string().max(500).nullable().optional(),
   isActive: z.boolean().optional(),
});

// --- Composite input schemas ---

export const listServicesInputSchema = z
   .object({
      search: z.string().optional(),
      categoryId: z.string().uuid().optional(),
   })
   .optional();

export const listSubscriptionsInputSchema = z
   .object({
      status: z.enum(["active", "completed", "cancelled"]).optional(),
   })
   .optional();

export const listExpiringSoonInputSchema = z
   .object({
      status: z.enum(["active", "trialing"]).optional().default("active"),
   })
   .optional();

export const idInputSchema = z.object({ id: z.string().uuid() });
export const serviceIdInputSchema = z.object({ serviceId: z.string().uuid() });
export const priceIdInputSchema = z.object({ priceId: z.string().uuid() });
export const contactIdInputSchema = z.object({ contactId: z.string().uuid() });
export const subscriptionIdInputSchema = z.object({
   subscriptionId: z.string().uuid(),
});
export const serviceBenefitLinkSchema = z.object({
   serviceId: z.string().uuid(),
   benefitId: z.string().uuid(),
});
export const bulkCreateServicesInputSchema = z.object({
   items: z.array(createServiceSchema).min(1),
});
export const createPriceForServiceInputSchema =
   serviceIdInputSchema.merge(createPriceSchema);
export const updateServiceInputSchema =
   idInputSchema.merge(updateServiceSchema);
export const updatePriceInputSchema = idInputSchema.merge(updatePriceSchema);
export const updateMeterInputSchema = idInputSchema.merge(updateMeterSchema);
export const updateBenefitInputSchema =
   idInputSchema.merge(updateBenefitSchema);

// --- Types ---

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreatePriceInput = z.infer<typeof createPriceSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
export type CreateMeterInput = z.infer<typeof createMeterSchema>;
export type UpdateMeterInput = z.infer<typeof updateMeterSchema>;
export type CreateBenefitInput = z.infer<typeof createBenefitSchema>;
export type UpdateBenefitInput = z.infer<typeof updateBenefitSchema>;
export type ListServicesInput = z.infer<typeof listServicesInputSchema>;
export type ListSubscriptionsInput = z.infer<
   typeof listSubscriptionsInputSchema
>;
export type ListExpiringSoonInput = z.infer<typeof listExpiringSoonInputSchema>;
export type ServiceBenefitLinkInput = z.infer<typeof serviceBenefitLinkSchema>;
export type BulkCreateServicesInput = z.infer<
   typeof bulkCreateServicesInputSchema
>;
