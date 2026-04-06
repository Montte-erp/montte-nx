import { WebAppError } from "@core/logging/errors";
import { enforceCreditBudget, incrementUsage } from "@packages/events/credits";
import { protectedProcedure } from "../server";

export function withCreditEnforcement(eventName: string) {
   return protectedProcedure.use(async ({ context, next }) => {
      try {
         await enforceCreditBudget(
            context.organizationId,
            eventName,
            context.redis,
         );
      } catch (err) {
         if (
            err instanceof Error &&
            err.message.startsWith("Free tier limit exceeded")
         ) {
            throw WebAppError.forbidden(
               "Limite do plano gratuito atingido. Faça upgrade para continuar.",
            );
         }
         throw err;
      }

      const result = await next();

      try {
         await incrementUsage(context.organizationId, eventName, context.redis);
      } catch {}

      return result;
   });
}
