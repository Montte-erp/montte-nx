import { WebAppError } from "@core/logging/errors";
import {
   createCouponSchema,
   updateCouponSchema,
} from "@core/database/schemas/coupons";
import {
   createCoupon,
   ensureCouponOwnership,
   getCoupon,
   getCouponByCode,
   listCoupons,
   updateCoupon,
} from "@core/database/repositories/coupons-repository";
import { protectedProcedure } from "@core/orpc/server";
import { z } from "zod";
import dayjs from "dayjs";

export const list = protectedProcedure.handler(async ({ context }) =>
   (await listCoupons(context.db, context.teamId)).match(
      (rows) => rows,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   ),
);

export const get = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      (await ensureCouponOwnership(context.db, input.id, context.teamId)).match(
         () => {},
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return (await getCoupon(context.db, input.id)).match(
         (row) => row,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const create = protectedProcedure
   .input(createCouponSchema)
   .handler(async ({ context, input }) =>
      (await createCoupon(context.db, context.teamId, input)).match(
         (row) => row,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(updateCouponSchema))
   .handler(async ({ context, input }) => {
      (await ensureCouponOwnership(context.db, input.id, context.teamId)).match(
         () => {},
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      const { id, ...data } = input;
      return (await updateCoupon(context.db, id, data)).match(
         (row) => row,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const deactivate = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      (await ensureCouponOwnership(context.db, input.id, context.teamId)).match(
         () => {},
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return (
         await updateCoupon(context.db, input.id, { isActive: false })
      ).match(
         (row) => row,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const validate = protectedProcedure
   .input(
      z.object({
         code: z.string().min(1),
         priceId: z.string().uuid().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      if (context.hyprpayClient) {
         const result = await context.hyprpayClient.coupons.validate({
            code: input.code,
            priceId: input.priceId,
         });
         return result.match(
            (v) => v,
            () => {
               throw WebAppError.internal("Falha ao validar cupom.");
            },
         );
      }

      const result = await getCouponByCode(
         context.db,
         context.teamId,
         input.code,
      );
      if (result.isErr()) throw WebAppError.fromAppError(result.error);

      const coupon = result.value;
      if (!coupon)
         return { valid: false as const, reason: "not_found" as const };
      if (!coupon.isActive)
         return { valid: false as const, reason: "inactive" as const };
      if (coupon.redeemBy && dayjs().isAfter(dayjs(coupon.redeemBy)))
         return { valid: false as const, reason: "expired" as const };
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
         return { valid: false as const, reason: "max_uses_reached" as const };
      if (
         coupon.scope === "price" &&
         input.priceId &&
         coupon.priceId !== input.priceId
      )
         return {
            valid: false as const,
            reason: "price_scope_mismatch" as const,
         };

      return {
         valid: true as const,
         coupon: {
            id: coupon.id,
            code: coupon.code,
            type: coupon.type,
            amount: coupon.amount,
            duration: coupon.duration,
            durationMonths: coupon.durationMonths,
            scope: coupon.scope,
            priceId: coupon.priceId ?? null,
         },
      };
   });
