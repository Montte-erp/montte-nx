import { auth, getDevMagicLink } from "@core/authentication/server";
import { createFileRoute } from "@tanstack/react-router";

function handleDevMagicLink(request: Request): Response | null {
   const url = new URL(request.url);
   if (url.pathname !== "/api/auth/dev/magic-link") return null;
   const email = url.searchParams.get("email") ?? "";
   return Response.json({ url: getDevMagicLink(email) ?? null });
}

export const Route = createFileRoute("/api/auth/$")({
   server: {
      handlers: {
         GET: async ({ request }) => {
            return handleDevMagicLink(request) ?? auth.handler(request);
         },
         POST: async ({ request }) => {
            return auth.handler(request);
         },
      },
   },
});
