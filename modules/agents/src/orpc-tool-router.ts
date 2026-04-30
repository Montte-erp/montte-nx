import { createRouterClient } from "@orpc/server";
import * as benefitsRouter from "@modules/billing/router/benefits";
import * as couponsRouter from "@modules/billing/router/coupons";
import * as metersRouter from "@modules/billing/router/meters";
import * as pricesRouter from "@modules/billing/router/prices";
import * as servicesRouter from "@modules/billing/router/services";

export const rubiToolRouter = {
   benefits: benefitsRouter,
   coupons: couponsRouter,
   meters: metersRouter,
   prices: pricesRouter,
   services: servicesRouter,
};

export type RubiToolRouter = typeof rubiToolRouter;

export function createRubiToolClient(headers: Headers, request: Request) {
   return createRouterClient(rubiToolRouter, {
      context: { headers, request },
   });
}

export type RubiToolClient = ReturnType<typeof createRubiToolClient>;
