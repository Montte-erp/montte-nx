import { auth, getDevMagicLink } from "@core/authentication/server";
import {
   isArcjetRateLimitDecision,
   protectWithRateLimit,
} from "@core/arcjet/protect";
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
            const decision = await protectWithRateLimit(request, {
               max: 30,
               interval: "1m",
               characteristics: ["ip.src", "http.request.uri.path"],
            });

            if (decision.isDenied()) {
               const isRateLimit = isArcjetRateLimitDecision(decision);
               return new Response(
                  isRateLimit ? "Rate limit exceeded" : "Forbidden",
                  {
                     status: isRateLimit ? 429 : 403,
                  },
               );
            }

            return handleDevMagicLink(request) ?? auth.handler(request);
         },
         POST: async ({ request }) => {
            const decision = await protectWithRateLimit(request, {
               max: 30,
               interval: "1m",
               characteristics: ["ip.src", "http.request.uri.path"],
            });

            if (decision.isDenied()) {
               const isRateLimit = isArcjetRateLimitDecision(decision);
               return new Response(
                  isRateLimit ? "Rate limit exceeded" : "Forbidden",
                  {
                     status: isRateLimit ? 429 : 403,
                  },
               );
            }

            return auth.handler(request);
         },
      },
   },
});
