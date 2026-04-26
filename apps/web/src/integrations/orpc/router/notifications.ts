import { eventIterator } from "@orpc/server";
import { sseEnvelopeSchema, type SseScope } from "@core/sse/types";
import { subscribeSse } from "@core/sse/subscriber";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "../server";

const logger = getLogger().child({ module: "notifications.subscribe" });

export const subscribe = protectedProcedure
   .output(eventIterator(sseEnvelopeSchema))
   .handler(async function* ({ context, signal }) {
      logger.info(
         {
            userId: context.userId,
            teamId: context.teamId,
            organizationId: context.organizationId,
         },
         "SSE subscribe started",
      );
      const scopes: SseScope[] = [
         { kind: "user", id: context.userId },
         { kind: "team", id: context.teamId },
         { kind: "org", id: context.organizationId },
      ];
      try {
         for await (const envelope of subscribeSse(
            context.redis,
            scopes,
            signal,
         )) {
            logger.info(
               {
                  type: envelope.type,
                  scope: envelope.scope,
               },
               "SSE event received",
            );
            yield envelope;
         }
      } finally {
         logger.info(
            {
               userId: context.userId,
               teamId: context.teamId,
            },
            "SSE subscribe ended",
         );
      }
   });
