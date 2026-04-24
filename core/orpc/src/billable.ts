import { protectedProcedure } from "./server";

export function createBillableProcedure(eventName: string) {
   return protectedProcedure.use(async ({ next }) => {
      // TODO: enforce via HyprPay once plugin is configured
      void eventName;
      return next({});
   });
}
