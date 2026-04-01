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
      } catch {
         throw WebAppError.forbidden(
            "Limite do plano gratuito atingido. Faça upgrade para continuar.",
         );
      }

      const result = await next();

      await incrementUsage(context.organizationId, eventName, context.redis);

      return result;
   });
}
