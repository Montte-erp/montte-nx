import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@core/authentication/server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/.well-known/oauth-authorization-server/$",
)({
   server: {
      handlers: {
         GET: ({ request }) => oauthProviderAuthServerMetadata(auth)(request),
      },
   },
});
