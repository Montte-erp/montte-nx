import { WebAppError } from "@core/logging/errors";
import {
   createCoupon,
   ensureCouponOwnership,
   getCoupon,
   listCoupons,
   updateCoupon,
} from "@core/database/repositories/coupons-repository";
import { protectedProcedure } from "@core/orpc/server";
import {
   createCouponSchema,
   getCouponInputSchema,
   updateCouponInputSchema,
   validateCouponInputSchema,
} from "../contracts/coupons";

export const list = protectedProcedure.handler(async ({ context }) =>
   (await listCoupons(context.db, context.teamId)).match(
      (rows) => rows,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   ),
);

export const get = protectedProcedure
   .input(getCouponInputSchema)
   .use(({ context, input, next }) =>
      ensureCouponOwnership(context.db, input.id, context.teamId).match(
         () => next({}),
         (e) => Promise.reject(WebAppError.fromAppError(e)),
      ),
   )
   .handler(async ({ context, input }) =>
      (await getCoupon(context.db, input.id)).match(
         (row) => row,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

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
   .input(updateCouponInputSchema)
   .use(({ context, input, next }) =>
      ensureCouponOwnership(context.db, input.id, context.teamId).match(
         () => next({}),
         (e) => Promise.reject(WebAppError.fromAppError(e)),
      ),
   )
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (await updateCoupon(context.db, id, data)).match(
         (row) => row,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const deactivate = protectedProcedure
   .input(getCouponInputSchema)
   .use(({ context, input, next }) =>
      ensureCouponOwnership(context.db, input.id, context.teamId).match(
         () => next({}),
         (e) => Promise.reject(WebAppError.fromAppError(e)),
      ),
   )
   .handler(async ({ context, input }) =>
      (await updateCoupon(context.db, input.id, { isActive: false })).match(
         (row) => row,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const validate = protectedProcedure
   .input(validateCouponInputSchema)
   .handler(async ({ context, input }) => {
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
   });
