import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { of, toMinorUnitsString } from "@f-o-t/money";
import {
   coupons,
   couponScopeEnum,
   couponTypeEnum,
   couponDurationEnum,
} from "@core/database/schemas/coupons";

const amountSchema = z
   .string()
   .regex(/^\d+(\.\d+)?$/, "Valor deve ser um número positivo.")
   .refine((v) => Number(toMinorUnitsString(of(v, "BRL"))) > 0, {
      message: "Valor deve ser um número positivo.",
   });

export const createCouponSchema = createInsertSchema(coupons)
   .pick({
      code: true,
      scope: true,
      priceId: true,
      type: true,
      amount: true,
      duration: true,
      durationMonths: true,
      maxUses: true,
      redeemBy: true,
   })
   .extend({
      code: z
         .string()
         .min(1)
         .max(50, "Código deve ter no máximo 50 caracteres."),
      scope: z.enum(couponScopeEnum.enumValues).default("team"),
      priceId: z.string().uuid().nullable().optional(),
      type: z.enum(couponTypeEnum.enumValues),
      amount: amountSchema,
      duration: z.enum(couponDurationEnum.enumValues),
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

export const updateCouponSchema = z.object({
   isActive: z.boolean().optional(),
   maxUses: z.number().int().min(1).nullable().optional(),
   redeemBy: z.string().datetime().nullable().optional(),
});

export const getCouponInputSchema = z.object({ id: z.string().uuid() });

export const updateCouponInputSchema =
   getCouponInputSchema.merge(updateCouponSchema);

export const validateCouponInputSchema = z.object({
   code: z.string().min(1),
   priceId: z.string().uuid().optional(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type GetCouponInput = z.infer<typeof getCouponInputSchema>;
export type UpdateCouponInputWithId = z.infer<typeof updateCouponInputSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponInputSchema>;
