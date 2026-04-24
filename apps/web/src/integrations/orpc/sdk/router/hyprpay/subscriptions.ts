import { implementerInternal } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import { requireTeamId } from "./utils";
import {
   createSubscriptionWithItems,
   listSubscriptionsByContact,
   updateSubscription,
   ensureSubscriptionOwnership,
} from "@core/database/repositories/subscriptions-repository";
import {
   addSubscriptionItem,
   updateSubscriptionItemQuantity,
   removeSubscriptionItem,
   ensureSubscriptionItemOwnership,
} from "@core/database/repositories/subscription-items-repository";
import { getCouponByCode } from "@core/database/repositories/coupons-repository";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import type {
   ContactSubscription,
   UpdateSubscriptionInput,
} from "@core/database/schemas/subscriptions";
import type { SubscriptionItem } from "@core/database/schemas/subscription-items";
import dayjs from "dayjs";

const impl = implementerInternal(
   hyprpayContract.subscriptions,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

function mapSubscription(sub: ContactSubscription) {
   return {
      id: sub.id,
      contactId: sub.contactId,
      teamId: sub.teamId,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate ?? null,
      couponId: sub.couponId ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      checkoutUrl: null satisfies string | null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
   };
}

function mapItem(item: SubscriptionItem) {
   return {
      id: item.id,
      subscriptionId: item.subscriptionId,
      priceId: item.priceId,
      quantity: item.quantity,
      negotiatedPrice: item.negotiatedPrice ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
   };
}

export const create = impl.create.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(
      context.db,
      input.customerId,
      teamId,
      "cliente",
   );
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value || contactResult.value.isArchived) {
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });
   }
   const contact = contactResult.value;

   let couponId: string | null = null;
   if (input.couponCode) {
      const couponResult = await getCouponByCode(
         context.db,
         teamId,
         input.couponCode,
      );
      if (couponResult.isErr())
         throw WebAppError.fromAppError(couponResult.error);
      const coupon = couponResult.value;
      if (!coupon) {
         throw new WebAppError("BAD_REQUEST", {
            message: "Cupom não encontrado.",
            source: "hyprpay",
         });
      }
      if (!coupon.isActive) {
         throw new WebAppError("BAD_REQUEST", {
            message: "Cupom inativo.",
            source: "hyprpay",
         });
      }
      if (coupon.redeemBy && dayjs().isAfter(coupon.redeemBy)) {
         throw new WebAppError("BAD_REQUEST", {
            message: "Cupom expirado.",
            source: "hyprpay",
         });
      }
      if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
         throw new WebAppError("BAD_REQUEST", {
            message: "Cupom sem usos restantes.",
            source: "hyprpay",
         });
      }
      couponId = coupon.id;
   }

   const subscriptionResult = await createSubscriptionWithItems(
      context.db,
      teamId,
      {
         contactId: contact.id,
         startDate: dayjs().format("YYYY-MM-DD"),
         status: "active",
         source: "manual",
         couponId,
         cancelAtPeriodEnd: false,
      },
      input.items.map((item) => ({
         priceId: item.priceId,
         quantity: item.quantity ?? 1,
      })),
   );
   if (subscriptionResult.isErr())
      throw WebAppError.fromAppError(subscriptionResult.error);

   return {
      subscription: mapSubscription(subscriptionResult.value),
      checkoutUrl: null,
   };
});

export const cancel = impl.cancel.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const ownershipResult = await ensureSubscriptionOwnership(
      context.db,
      input.subscriptionId,
      teamId,
   );
   if (ownershipResult.isErr())
      throw WebAppError.fromAppError(ownershipResult.error);

   const updateData: UpdateSubscriptionInput = input.cancelAtPeriodEnd
      ? { cancelAtPeriodEnd: true }
      : { status: "cancelled", cancelAtPeriodEnd: false };

   const updatedResult = await updateSubscription(
      context.db,
      input.subscriptionId,
      updateData,
   );
   if (updatedResult.isErr())
      throw WebAppError.fromAppError(updatedResult.error);

   return mapSubscription(updatedResult.value);
});

export const list = impl.list.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(
      context.db,
      input.customerId,
      teamId,
      "cliente",
   );
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value || contactResult.value.isArchived) {
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });
   }

   const subsResult = await listSubscriptionsByContact(
      context.db,
      contactResult.value.id,
   );
   if (subsResult.isErr()) throw WebAppError.fromAppError(subsResult.error);

   return subsResult.value.map(mapSubscription);
});

export const addItem = impl.addItem.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const itemResult = await addSubscriptionItem(context.db, teamId, {
      subscriptionId: input.subscriptionId,
      priceId: input.priceId,
      quantity: input.quantity ?? 1,
   });
   if (itemResult.isErr()) throw WebAppError.fromAppError(itemResult.error);

   return mapItem(itemResult.value);
});

export const updateItem = impl.updateItem.handler(
   async ({ context, input }) => {
      const teamIdResult = requireTeamId(context.teamId);
      if (teamIdResult.isErr()) throw teamIdResult.error;
      const teamId = teamIdResult.value;

      const ownershipResult = await ensureSubscriptionItemOwnership(
         context.db,
         input.itemId,
         teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);

      const updatedResult = await updateSubscriptionItemQuantity(
         context.db,
         input.itemId,
         {
            quantity: input.quantity,
            negotiatedPrice: input.negotiatedPrice,
         },
      );
      if (updatedResult.isErr())
         throw WebAppError.fromAppError(updatedResult.error);

      return mapItem(updatedResult.value);
   },
);

export const removeItem = impl.removeItem.handler(
   async ({ context, input }) => {
      const teamIdResult = requireTeamId(context.teamId);
      if (teamIdResult.isErr()) throw teamIdResult.error;
      const teamId = teamIdResult.value;

      const ownershipResult = await ensureSubscriptionItemOwnership(
         context.db,
         input.itemId,
         teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);

      const removeResult = await removeSubscriptionItem(
         context.db,
         input.itemId,
      );
      if (removeResult.isErr())
         throw WebAppError.fromAppError(removeResult.error);

      return { success: true };
   },
);
