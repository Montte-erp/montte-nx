import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { z } from "zod";
import { billingContract } from "@montte/hyprpay/contract";
import { implementerInternal } from "@orpc/server";
import { coupons } from "@core/database/schemas/coupons";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import type {
   ORPCContext,
   ORPCContextWithOrganization,
} from "@core/orpc/server";

const def = protectedProcedure["~orpc"];
const impl = implementerInternal<
   typeof billingContract.coupons,
   ORPCContext,
   ORPCContextWithOrganization
>(billingContract.coupons, def.config, [...def.middlewares]);

export const list = impl.list.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.coupons.findMany({
         where: (f, { eq: eqFn }) => eqFn(f.teamId, context.teamId),
         orderBy: (f, { asc }) => [asc(f.createdAt)],
      }),
      () => WebAppError.internal("Falha ao listar cupons."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const get = impl.get
   .use(async ({ context, next }, input) => {
      const result = await fromPromise(
         context.db.query.coupons.findFirst({
            where: (f, { eq: eqFn }) => eqFn(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((coupon) =>
         !coupon || coupon.teamId !== context.teamId
            ? err(WebAppError.notFound("Cupom não encontrado."))
            : ok(coupon),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { coupon: result.value } });
   })
   .handler(({ context }) => context.coupon);

export const create = impl.create.handler(async ({ context, input }) => {
   const existing = await fromPromise(
      context.db.query.coupons.findFirst({
         where: (f, { and, eq: eqFn, sql }) =>
            and(
               eqFn(f.teamId, context.teamId),
               sql`lower(${f.code}) = lower(${input.code})`,
            ),
      }),
      () => WebAppError.internal("Falha ao verificar cupom existente."),
   );
   if (existing.isErr()) throw existing.error;
   if (existing.value)
      throw WebAppError.conflict("Já existe um cupom com esse código.");

   const result = await fromPromise(
      context.db.transaction(async (tx) => {
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
         return row;
      }),
      () => WebAppError.internal("Falha ao criar cupom."),
   );
   if (result.isErr()) throw result.error;
   if (!result.value)
      throw WebAppError.internal(
         "Falha ao criar cupom: insert retornou vazio.",
      );
   return result.value;
});

export const update = impl.update
   .use(async ({ context, next }, input) => {
      const result = await fromPromise(
         context.db.query.coupons.findFirst({
            where: (f, { eq: eqFn }) => eqFn(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((coupon) =>
         !coupon || coupon.teamId !== context.teamId
            ? err(WebAppError.notFound("Cupom não encontrado."))
            : ok(coupon),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { coupon: result.value } });
   })
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (
         data.code &&
         data.code.toLowerCase() !== context.coupon.code.toLowerCase()
      ) {
         const dup = await fromPromise(
            context.db.query.coupons.findFirst({
               where: (f, { and, eq: eqFn, sql, ne }) =>
                  and(
                     eqFn(f.teamId, context.teamId),
                     ne(f.id, id),
                     sql`lower(${f.code}) = lower(${data.code})`,
                  ),
            }),
            () => WebAppError.internal("Falha ao verificar cupom existente."),
         );
         if (dup.isErr()) throw dup.error;
         if (dup.value)
            throw WebAppError.conflict("Já existe um cupom com esse código.");
      }
      const result = await fromPromise(
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
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar cupom."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar cupom: update retornou vazio.",
         );
      return result.value;
   });

export const deactivate = impl.deactivate
   .use(async ({ context, next }, input) => {
      const result = await fromPromise(
         context.db.query.coupons.findFirst({
            where: (f, { eq: eqFn }) => eqFn(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((coupon) =>
         !coupon || coupon.teamId !== context.teamId
            ? err(WebAppError.notFound("Cupom não encontrado."))
            : ok(coupon),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { coupon: result.value } });
   })
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(coupons)
               .set({ isActive: false })
               .where(eq(coupons.id, input.id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao desativar cupom."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao desativar cupom: update retornou vazio.",
         );
      return result.value;
   });

export const bulkSetActive = protectedProcedure
   .input(
      z.object({
         ids: z.array(z.string().uuid()).min(1),
         isActive: z.boolean(),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(coupons)
               .set({ isActive: input.isActive })
               .where(
                  and(
                     inArray(coupons.id, input.ids),
                     eq(coupons.teamId, context.teamId),
                  ),
               )
               .returning({ id: coupons.id }),
         ),
         () => WebAppError.internal("Falha ao atualizar cupons."),
      );
      if (result.isErr()) throw result.error;
      return { updated: result.value.length };
   });

export const validate = impl.validate.handler(async ({ context, input }) => {
   const result = await fromPromise(
      context.db.query.coupons.findFirst({
         where: (f, { and: andFn, eq: eqFn, sql }) =>
            andFn(
               eqFn(f.teamId, context.teamId),
               sql`lower(${f.code}) = lower(${input.code})`,
            ),
      }),
      () => WebAppError.internal("Falha ao validar cupom."),
   );
   if (result.isErr()) throw result.error;
   const coupon = result.value;
   if (!coupon) return { valid: false as const, reason: "not_found" as const };
   if (!coupon.isActive)
      return { valid: false as const, reason: "inactive" as const };
   if (coupon.redeemBy && dayjs().isAfter(coupon.redeemBy))
      return { valid: false as const, reason: "expired" as const };
   if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
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
         priceId: coupon.priceId,
         meterId: coupon.meterId,
         direction: coupon.direction,
         maxUses: coupon.maxUses,
         usedCount: coupon.usedCount,
         redeemBy: coupon.redeemBy ? coupon.redeemBy.toISOString() : null,
      },
   };
});
