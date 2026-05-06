import { createRouterClient } from "@orpc/server";
import * as benefitsRouter from "@modules/billing/router/benefits";
import * as couponsRouter from "@modules/billing/router/coupons";
import * as metersRouter from "@modules/billing/router/meters";
import * as pricesRouter from "@modules/billing/router/prices";
import * as servicesRouter from "@modules/billing/router/services";

export const agentToolRouter = {
   benefits: benefitsRouter,
   coupons: couponsRouter,
   meters: metersRouter,
   prices: pricesRouter,
   services: {
      bulkSetActive: servicesRouter.bulkSetActive,
      getAll: servicesRouter.getAll,
      getById: servicesRouter.getById,
      setup: servicesRouter.setup,
      update: servicesRouter.update,
   },
};

export type AgentToolRouter = typeof agentToolRouter;

export function createAgentToolClient(headers: Headers, request: Request) {
   return createRouterClient(agentToolRouter, {
      context: { headers, request },
   });
}

export type AgentToolClient = ReturnType<typeof createAgentToolClient>;
