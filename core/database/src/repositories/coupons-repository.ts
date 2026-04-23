import { AppError, validateInput } from "@core/logging/errors";
import { eq, sql } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateCouponInput,
   type UpdateCouponInput,
   createCouponSchema,
   updateCouponSchema,
   coupons,
   couponRedemptions,
} from "@core/database/schemas/coupons";

const safeValidateCreate = fromThrowable(
   (data: CreateCouponInput) => validateInput(createCouponSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateCouponInput) => validateInput(updateCouponSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

export function createCoupon(
   db: DatabaseInstance,
   teamId: string,
   data: CreateCouponInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const existing = await tx.query.coupons.findFirst({
               where: (fields, { and, eq, sql }) =>
                  and(
                     eq(fields.teamId, teamId),
                     sql`lower(${fields.code}) = lower(${validated.code})`,
                  ),
            });
            if (existing)
               throw AppError.conflict("Já existe um cupom com esse código.");
            const [row] = await tx
               .insert(coupons)
               .values({
                  ...validated,
                  teamId,
                  redeemBy: validated.redeemBy
                     ? new Date(validated.redeemBy)
                     : undefined,
               })
               .returning();
            if (!row) throw AppError.database("Falha ao criar cupom.");
            return row;
         }),
         (e) =>
            e instanceof AppError
               ? e
               : AppError.database("Falha ao criar cupom.", { cause: e }),
      ),
   );
}

export function getCoupon(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.coupons.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar cupom.", { cause: e }),
   ).map((coupon) => coupon ?? null);
}

export function getCouponByCode(
   db: DatabaseInstance,
   teamId: string,
   code: string,
) {
   return fromPromise(
      db.query.coupons.findFirst({
         where: (fields, { and, eq, sql }) =>
            and(
               eq(fields.teamId, teamId),
               sql`lower(${fields.code}) = lower(${code})`,
            ),
      }),
      (e) => AppError.database("Falha ao buscar cupom.", { cause: e }),
   ).map((coupon) => coupon ?? null);
}

export function listCoupons(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db
         .select()
         .from(coupons)
         .where(eq(coupons.teamId, teamId))
         .orderBy(coupons.createdAt),
      (e) => AppError.database("Falha ao listar cupons.", { cause: e }),
   );
}

export function updateCoupon(
   db: DatabaseInstance,
   id: string,
   data: UpdateCouponInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(coupons)
            .set({
               ...validated,
               redeemBy: validated.redeemBy
                  ? new Date(validated.redeemBy)
                  : validated.redeemBy,
            })
            .where(eq(coupons.id, id))
            .returning(),
         (e) => AppError.database("Falha ao atualizar cupom.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Cupom não encontrado.")),
      ),
   );
}

export function ensureCouponOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getCoupon(db, id).andThen((coupon) => {
      if (!coupon || coupon.teamId !== teamId)
         return err(AppError.notFound("Cupom não encontrado."));
      return ok(coupon);
   });
}

export function redeemCoupon(
   db: DatabaseInstance,
   teamId: string,
   params: { couponId: string; subscriptionId: string; contactId: string },
) {
   return fromPromise(
      db.transaction(async (tx) => {
         const coupon = await tx.query.coupons.findFirst({
            where: (f, { eq }) => eq(f.id, params.couponId),
         });
         if (!coupon || coupon.teamId !== teamId)
            throw AppError.notFound("Cupom não encontrado.");
         if (!coupon.isActive) throw AppError.badRequest("Cupom inativo.");
         if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
            throw AppError.badRequest("Limite de usos do cupom atingido.");
         if (coupon.redeemBy && new Date() > coupon.redeemBy)
            throw AppError.badRequest("Cupom expirado.");

         await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(eq(coupons.id, params.couponId));
         const [redemption] = await tx
            .insert(couponRedemptions)
            .values({
               teamId,
               couponId: params.couponId,
               subscriptionId: params.subscriptionId,
               contactId: params.contactId,
               discountSnapshot: {
                  code: coupon.code,
                  type: coupon.type,
                  amount: coupon.amount,
                  duration: coupon.duration,
                  durationMonths: coupon.durationMonths ?? null,
               },
            })
            .returning();
         if (!redemption) throw AppError.database("Falha ao resgatar cupom.");
         return redemption;
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao resgatar cupom.", { cause: e }),
   );
}
