import { eventIterator } from "@orpc/server";
import { jobNotificationSchema } from "@packages/notifications/schema";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "../server";
import { jobPublisher } from "@/integrations/dbos/publisher";

const logger = getLogger().child({ module: "notifications.subscribe" });

export const subscribe = protectedProcedure
   .output(eventIterator(jobNotificationSchema))
   .handler(async function* ({ context, signal }) {
      logger.info({ teamId: context.teamId }, "SSE subscribe started");
      const iterator = jobPublisher.subscribe("job.notification", { signal });
      try {
         for await (const event of iterator) {
            logger.info(
               {
                  eventTeamId: event.teamId,
                  contextTeamId: context.teamId,
                  type: event.type,
               },
               "SSE event received",
            );
            if (event.teamId !== context.teamId) continue;
            yield event;
         }
      } finally {
         logger.info({ teamId: context.teamId }, "SSE subscribe ended");
         await iterator.return?.();
      }
   });
