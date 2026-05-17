import type { EventSink } from "@betternotify/core";
import { createPlugin } from "@betternotify/core/plugins";
import { withEventLogger } from "@betternotify/core/middlewares";
import { log } from "@core/logging";

const notificationEventSink: EventSink = {
   write: async (event) => {
      if (event.status === "success") {
         log.info({
            module: "notifications",
            event: "notification_send_succeeded",
            message: "Notification send succeeded",
            route: event.route,
            messageId: event.messageId,
            durationMs: Math.round(event.durationMs),
         });
         return;
      }

      log.error({
         module: "notifications",
         event: "notification_send_failed",
         message: "Notification send failed",
         route: event.route,
         messageId: event.messageId,
         durationMs: Math.round(event.durationMs),
         errorName: event.error?.name,
         errorCode: event.error?.code,
         errorMessage: event.error?.message,
      });
   },
};

export const notificationObservabilityPlugin = createPlugin({
   name: "montte-notification-observability",
   middleware: [withEventLogger({ sink: notificationEventSink })],
});
