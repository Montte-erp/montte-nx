import { implementerInternal } from "@orpc/server";
import { billingContract } from "@montte/hyprpay/contract";
import { protectedProcedure } from "@core/orpc/server";
import type {
   ORPCContext,
   ORPCContextWithOrganization,
} from "@core/orpc/server";

const def = protectedProcedure["~orpc"];

export const billingImpl = {
   services: implementerInternal<
      typeof billingContract.services,
      ORPCContext,
      ORPCContextWithOrganization
   >(billingContract.services, def.config, [...def.middlewares]),
   contacts: implementerInternal<
      typeof billingContract.contacts,
      ORPCContext,
      ORPCContextWithOrganization
   >(billingContract.contacts, def.config, [...def.middlewares]),
   coupons: implementerInternal<
      typeof billingContract.coupons,
      ORPCContext,
      ORPCContextWithOrganization
   >(billingContract.coupons, def.config, [...def.middlewares]),
   customerPortal: implementerInternal<
      typeof billingContract.customerPortal,
      ORPCContext,
      ORPCContextWithOrganization
   >(billingContract.customerPortal, def.config, [...def.middlewares]),
};
