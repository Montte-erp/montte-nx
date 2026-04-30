import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";
import { errAsync, fromPromise, okAsync, safeTry } from "neverthrow";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import {
   coupons,
   createCouponSchema,
   updateCouponSchema,
} from "@core/database/schemas/coupons";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireCoupon } from "@modules/billing/router/middlewares";

const idInputSchema = z.object({ id: z.string().uuid() });

const updateInputSchema = z
   .object({ id: z.string().uuid() })
   .merge(updateCouponSchema);

const validateInputSchema = z.object({
   code: z.string().min(1),
   priceId: z.string().uuid().optional(),
});

const bulkSetActiveInputSchema = z.object({
   ids: z.array(z.string().uuid()).min(1),
   isActive: z.boolean(),
});

type Coupon = typeof coupons.$inferSelect;

const ensureCodeFree = (
   db: DatabaseInstance,
   teamId: string,
   code: string,
   excludeId?: string,
) =>
   fromPromise(
      db.query.coupons.findFirst({
         where: (f, { and: andFn, eq: eqFn, sql, ne }) =>
            andFn(
               eqFn(f.teamId, teamId),
               sql`lower(${f.code}) = lower(${code})`,
               excludeId ? ne(f.id, excludeId) : undefined,
            ),
      }),
      () => WebAppError.internal("Falha ao verificar cupom existente."),
   ).andThen((existing) =>
      existing
         ? errAsync(WebAppError.conflict("Já existe um cupom com esse código."))
         : okAsync(undefined),
   );

const ensureRow = <T>(row: T | undefined, message: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(message));

export const list = protectedProcedure.handler(async ({ context }) => {
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

export const get = protectedProcedure
   .input(idInputSchema)
   .use(requireCoupon, (input) => input.id)
   .handler(({ context }) => context.coupon);

export const create = protectedProcedure
   .input(createCouponSchema)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         yield* ensureCodeFree(context.db, context.teamId, input.code);
         const row = yield* fromPromise(
            context.db.transaction(async (tx) => {
               const [inserted] = await tx
                  .insert(coupons)
                  .values({
                     ...input,
                     teamId: context.teamId,
                     redeemBy: input.redeemBy
                        ? dayjs(input.redeemBy).toDate()
                        : undefined,
                  })
                  .returning();
               return inserted;
            }),
            () => WebAppError.internal("Falha ao criar cupom."),
         );
         return ensureRow(row, "Falha ao criar cupom: insert retornou vazio.");
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(updateInputSchema)
   .use(requireCoupon, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await safeTry(async function* () {
         const codeChanged =
            data.code != null &&
            data.code.toLowerCase() !== context.coupon.code.toLowerCase();
         if (codeChanged && data.code) {
            yield* ensureCodeFree(context.db, context.teamId, data.code, id);
         }
         const row = yield* fromPromise(
            context.db.transaction(async (tx) => {
               const [updated] = await tx
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
               return updated;
            }),
            () => WebAppError.internal("Falha ao atualizar cupom."),
         );
         return ensureRow(
            row,
            "Falha ao atualizar cupom: update retornou vazio.",
         );
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const deactivate = protectedProcedure
   .input(idInputSchema)
   .use(requireCoupon, (input) => input.id)
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
      ).andThen((row) =>
         ensureRow(row, "Falha ao desativar cupom: update retornou vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const bulkSetActive = protectedProcedure
   .input(bulkSetActiveInputSchema)
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

type ValidationResult =
   | { valid: false; reason: "not_found" }
   | { valid: false; reason: "inactive" }
   | { valid: false; reason: "expired" }
   | { valid: false; reason: "max_uses_reached" }
   | { valid: false; reason: "price_scope_mismatch" }
   | { valid: true; coupon: ReturnType<typeof toValidCoupon> };

function toValidCoupon(coupon: Coupon) {
   return {
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
   };
}

function checkCoupon(
   coupon: Coupon | undefined,
   input: z.infer<typeof validateInputSchema>,
): ValidationResult {
   if (!coupon) return { valid: false, reason: "not_found" };
   if (!coupon.isActive) return { valid: false, reason: "inactive" };
   if (coupon.redeemBy && dayjs().isAfter(coupon.redeemBy))
      return { valid: false, reason: "expired" };
   if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
      return { valid: false, reason: "max_uses_reached" };
   if (
      coupon.scope === "price" &&
      input.priceId &&
      coupon.priceId !== input.priceId
   )
      return { valid: false, reason: "price_scope_mismatch" };
   return { valid: true, coupon: toValidCoupon(coupon) };
}

export const validate = protectedProcedure
   .input(validateInputSchema)
   .handler(async ({ context, input }) => {
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
      return checkCoupon(result.value, input);
   });
