import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { user as userTable } from "@core/database/schemas/auth";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import { protectedProcedure } from "./server";

export type EmitCtx = {
   organizationId: string;
   teamId?: string;
   userId?: string;
};

export function createBillableProcedure(eventName: string) {
   return protectedProcedure.use(async ({ context, next }) => {
      const userRecord = await context.db.query.user.findFirst({
         where: eq(userTable.id, context.userId),
         columns: { stripeCustomerId: true },
      });
      const stripeCustomerId = userRecord?.stripeCustomerId ?? null;

      try {
         await enforceCreditBudget(
            context.organizationId,
            eventName,
            context.redis,
            stripeCustomerId,
         );
      } catch {
         throw new ORPCError("FORBIDDEN", {
            message:
               "Free tier limit exceeded. Enable pay-as-you-go to continue.",
         });
      }

      const emit = createEmitFn(
         context.db,
         context.posthog,
         context.stripeClient,
         stripeCustomerId ?? undefined,
         context.redis,
      );
      const emitCtx: EmitCtx = {
         organizationId: context.organizationId,
         teamId: context.teamId,
         userId: context.userId,
      };

      let pendingEmit: (() => Promise<void>) | null = null;

      const result = await next({
         context: {
            ...context,
            emit,
            emitCtx,
            scheduleEmit: (fn: () => Promise<void>) => {
               pendingEmit = fn;
            },
         },
      });

      if (pendingEmit) await (pendingEmit as () => Promise<void>)();

      return result;
   });
}
