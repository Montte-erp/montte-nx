import { eq } from "drizzle-orm";
import { WebAppError } from "@core/logging/errors";
import type { DatabaseInstance } from "@core/database/client";
import { user as userTable } from "@core/database/schemas/auth";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import { redis, posthog, stripeClient } from "../singletons";
import { sdkProcedure } from "./server";

async function getStripeCustomerId(
   db: DatabaseInstance,
   userId: string,
): Promise<string | null> {
   const record = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: { stripeCustomerId: true },
   });
   return record?.stripeCustomerId ?? null;
}

export type EmitCtx = {
   organizationId: string;
   teamId?: string;
   userId?: string;
};

export function createBillableProcedure(eventName: string) {
   return sdkProcedure.use(async ({ context, next }) => {
      const stripeCustomerId = context.userId
         ? await getStripeCustomerId(context.db, context.userId)
         : null;

      try {
         await enforceCreditBudget(
            context.organizationId!,
            eventName,
            redis,
            stripeCustomerId,
         );
      } catch {
         throw new WebAppError("FORBIDDEN", {
            message:
               "Free tier limit exceeded. Enable pay-as-you-go to continue.",
            source: "billing",
         });
      }

      const emit = createEmitFn(
         context.db,
         posthog,
         stripeClient,
         stripeCustomerId ?? undefined,
         redis,
      );
      const emitCtx: EmitCtx = {
         organizationId: context.organizationId!,
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

      if (pendingEmit) {
         try {
            await (pendingEmit as () => Promise<void>)();
         } catch {
            // emit failure must not roll back the already-committed mutation
         }
      }

      return result;
   });
}
