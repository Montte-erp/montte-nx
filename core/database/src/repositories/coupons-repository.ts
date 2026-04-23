import { AppError, validateInput } from "@core/logging/errors";
import { and, count, eq, sql } from "drizzle-orm";
import dayjs from "dayjs";
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
import { contactSubscriptions } from "@core/database/schemas/subscriptions";

const safeValidateCreate = fromThrowable(
   (data: CreateCouponInput) => validateInput(createCouponSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateCouponInput) => validateInput(updateCouponSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
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
                     ? dayjs(validated.redeemBy).toDate()
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
      db.query.coupons.findMany({
         where: (fields, { eq }) => eq(fields.teamId, teamId),
         orderBy: (fields, { asc }) => [asc(fields.createdAt)],
      }),
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
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(coupons)
               .set({
                  ...validated,
                  redeemBy:
                     validated.redeemBy != null
                        ? dayjs(validated.redeemBy).toDate()
                        : validated.redeemBy,
               })
               .where(eq(coupons.id, id))
               .returning();
            if (!row) throw AppError.notFound("Cupom não encontrado.");
            return row;
         }),
         (e) => AppError.database("Falha ao atualizar cupom.", { cause: e }),
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

export function countCouponRedemptionsBySubscription(
   db: DatabaseInstance,
   subscriptionId: string,
) {
   return fromPromise(
      db
         .select({ count: count() })
         .from(couponRedemptions)
         .where(eq(couponRedemptions.subscriptionId, subscriptionId))
         .then(([row]) => row?.count ?? 0),
      (e) => AppError.database("Falha ao contar resgates.", { cause: e }),
   );
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
         if (!coupon.isActive) throw AppError.validation("Cupom inativo.");
         if (coupon.redeemBy && dayjs().isAfter(coupon.redeemBy))
            throw AppError.validation("Cupom expirado.");

         const subscription = await tx.query.contactSubscriptions.findFirst({
            where: (f, { eq }) => eq(f.id, params.subscriptionId),
         });
         if (!subscription || subscription.teamId !== teamId)
            throw AppError.notFound("Assinatura não encontrada.");

         const [updated] = await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(
               and(
                  eq(coupons.id, params.couponId),
                  coupon.maxUses != null
                     ? sql`${coupons.usedCount} < ${coupon.maxUses}`
                     : sql`true`,
               ),
            )
            .returning();
         if (!updated)
            throw AppError.validation("Limite de usos do cupom atingido.");

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
