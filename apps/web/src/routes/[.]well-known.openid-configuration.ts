import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { auth } from "@core/authentication/server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/openid-configuration")({
   server: {
      handlers: {
         GET: ({ request }) => oauthProviderOpenIdConfigMetadata(auth)(request),
      },
   },
});
