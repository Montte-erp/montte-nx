import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { coupons } from "@core/database/schemas/coupons";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   createCouponSchema,
   getCouponInputSchema,
   updateCouponInputSchema,
   validateCouponInputSchema,
} from "../contracts/coupons";

const couponByIdProcedure = protectedProcedure
   .input(getCouponInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.coupons.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (coupon) =>
            coupon?.teamId === context.teamId
               ? next({})
               : Promise.reject(WebAppError.notFound("Cupom não encontrado.")),
         (e) => Promise.reject(e),
      ),
   );

const couponByUpdateInputProcedure = protectedProcedure
   .input(updateCouponInputSchema)
   .use(({ context, input, next }) =>
      fromPromise(
         context.db.query.coupons.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).match(
         (coupon) =>
            coupon?.teamId === context.teamId
               ? next({})
               : Promise.reject(WebAppError.notFound("Cupom não encontrado.")),
         (e) => Promise.reject(e),
      ),
   );

export const list = protectedProcedure.handler(async ({ context }) =>
   (
      await fromPromise(
         context.db.query.coupons.findMany({
            where: (f, { eq }) => eq(f.teamId, context.teamId),
            orderBy: (f, { asc }) => [asc(f.createdAt)],
         }),
         () => WebAppError.internal("Falha ao listar cupons."),
      )
   ).match(
      (rows) => rows,
      (e) => {
         throw e;
      },
   ),
);

export const get = couponByIdProcedure.handler(async ({ context, input }) =>
   (
      await fromPromise(
         context.db.query.coupons.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao buscar cupom."),
      )
   ).match(
      (coupon) => {
         if (!coupon) throw WebAppError.notFound("Cupom não encontrado.");
         return coupon;
      },
      (e) => {
         throw e;
      },
   ),
);

export const create = protectedProcedure
   .input(createCouponSchema)
   .handler(async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const existing = await tx.query.coupons.findFirst({
                  where: (f, { and, eq, sql }) =>
                     and(
                        eq(f.teamId, context.teamId),
                        sql`lower(${f.code}) = lower(${input.code})`,
                     ),
               });
               if (existing)
                  throw WebAppError.conflict(
                     "Já existe um cupom com esse código.",
                  );

               const [row] = await tx
                  .insert(coupons)
                  .values({
                     ...input,
                     teamId: context.teamId,
                     redeemBy: input.redeemBy
                        ? dayjs(input.redeemBy).toDate()
                        : undefined,
                  })
                  .returning();
               if (!row) throw WebAppError.internal("Falha ao criar cupom.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao criar cupom."),
         )
      ).match(
         (row) => row,
         (e) => {
            throw e;
         },
      ),
   );

export const update = couponByUpdateInputProcedure.handler(
   async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(coupons)
                  .set({
                     ...data,
                     redeemBy:
                        data.redeemBy != null
                           ? dayjs(data.redeemBy).toDate()
                           : data.redeemBy,
                  })
                  .where(eq(coupons.id, id))
                  .returning();
               if (!row) throw WebAppError.notFound("Cupom não encontrado.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao atualizar cupom."),
         )
      ).match(
         (row) => row,
         (e) => {
            throw e;
         },
      );
   },
);

export const deactivate = couponByIdProcedure.handler(
   async ({ context, input }) =>
      (
         await fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(coupons)
                  .set({ isActive: false })
                  .where(eq(coupons.id, input.id))
                  .returning();
               if (!row) throw WebAppError.notFound("Cupom não encontrado.");
               return row;
            }),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao desativar cupom."),
         )
      ).match(
         (row) => row,
         (e) => {
            throw e;
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
