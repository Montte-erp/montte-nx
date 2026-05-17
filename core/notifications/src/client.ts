import { createClient } from "@betternotify/core";
import { resendTransport } from "@betternotify/resend";
import { notificationCatalog } from "@core/notifications/catalog";
import { notificationObservabilityPlugin } from "@core/notifications/logging";

export interface CreateNotificationsClientOptions {
   resendApiKey: string;
}

export function createNotificationsClient({
   resendApiKey,
}: CreateNotificationsClientOptions) {
   if (typeof resendApiKey !== "string" || resendApiKey.trim() === "") {
      throw new Error(
         "RESEND_API_KEY is required to create notifications client.",
      );
   }

   return createClient({
      catalog: notificationCatalog,
      transportsByChannel: {
         email: resendTransport({ apiKey: resendApiKey }),
      },
      plugins: [notificationObservabilityPlugin],
   });
}

export type NotificationsClient = ReturnType<typeof createNotificationsClient>;
