import { eventIterator } from "@orpc/server";
import { jobNotificationSchema } from "@packages/notifications/schema";
import { protectedProcedure } from "../server";
import { jobPublisher } from "../publisher";

export const subscribe = protectedProcedure
   .output(eventIterator(jobNotificationSchema))
   .handler(async function* ({ context, signal }) {
      const iterator = jobPublisher.subscribe("job.notification", { signal });
      try {
         for await (const event of iterator) {
            if (event.teamId !== context.teamId) continue;
            yield event;
         }
      } finally {
         await iterator.return?.();
      }
   });
