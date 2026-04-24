import { implementerInternal } from "@orpc/server";
import dayjs from "dayjs";
import { WebAppError } from "@core/logging/errors";
import { getCouponByCode } from "@core/database/repositories/coupons-repository";
import type { Coupon } from "@core/database/schemas/coupons";
import { hyprpayContract } from "@montte/hyprpay/contract";
import type { HyprPayCouponFromContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import { requireTeamId } from "./utils";

const impl = implementerInternal(
   hyprpayContract.coupons,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

type InvalidReason =
   | "not_found"
   | "inactive"
   | "expired"
   | "max_uses_reached"
   | "price_scope_mismatch";

function invalid(reason: InvalidReason): {
   valid: false;
   reason: InvalidReason;
} {
   return { valid: false, reason };
}

function mapCoupon(coupon: Coupon): HyprPayCouponFromContract {
   return {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      amount: coupon.amount,
      duration: coupon.duration,
      durationMonths: coupon.durationMonths ?? null,
      scope: coupon.scope,
      priceId: coupon.priceId ?? null,
      maxUses: coupon.maxUses ?? null,
      usedCount: coupon.usedCount,
      redeemBy: coupon.redeemBy ? coupon.redeemBy.toISOString() : null,
   };
}

export const validate = impl.validate.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const couponResult = await getCouponByCode(context.db, teamId, input.code);
   if (couponResult.isErr()) throw WebAppError.fromAppError(couponResult.error);

   const coupon = couponResult.value;

   if (!coupon) return invalid("not_found");
   if (!coupon.isActive) return invalid("inactive");
   if (coupon.redeemBy && dayjs().isAfter(coupon.redeemBy))
      return invalid("expired");
   if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
      return invalid("max_uses_reached");
   if (
      coupon.scope === "price" &&
      (input.priceId == null || coupon.priceId !== input.priceId)
   )
      return invalid("price_scope_mismatch");

   return { valid: true, coupon: mapCoupon(coupon) };
});
