import type { APIRoute } from "astro";
import { detectBot, tokenBucket, validateEmail } from "arcjet";
import arcjet from "arcjet:client";
import { fromPromise } from "neverthrow";
import { PostHog } from "posthog-node";

export const prerender = false;

const PUBLIC_POSTHOG_HOST = process.env.PUBLIC_POSTHOG_HOST;
const PUBLIC_POSTHOG_KEY = process.env.PUBLIC_POSTHOG_KEY;

let posthogClient: PostHog | null = null;
function getPosthog() {
   if (!PUBLIC_POSTHOG_KEY) return null;
   if (!posthogClient) {
      posthogClient = new PostHog(PUBLIC_POSTHOG_KEY, {
         host: PUBLIC_POSTHOG_HOST,
      });
   }
   return posthogClient;
}

const aj = arcjet
   .withRule(
      detectBot({
         mode: "LIVE",
         allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
      }),
   )
   .withRule(
      validateEmail({
         mode: "LIVE",
         deny: ["INVALID", "DISPOSABLE", "NO_MX_RECORDS"],
      }),
   )
   .withRule(
      tokenBucket({
         mode: "LIVE",
         refillRate: 5,
         interval: "60s",
         capacity: 10,
      }),
   );

export const POST: APIRoute = async (context) => {
   const parsed = await fromPromise(context.request.json(), () => null);
   if (parsed.isErr()) {
      return Response.json(
         { ok: false, reason: "invalid_body" },
         { status: 400 },
      );
   }
   const body: { email?: unknown; distinctId?: unknown } = parsed.value ?? {};

   const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
   const distinctId =
      typeof body.distinctId === "string" ? body.distinctId : email;

   if (!email || !email.includes("@")) {
      return Response.json(
         { ok: false, reason: "invalid_email" },
         { status: 400 },
      );
   }

   const decision = await aj.protect(context.request, { email, requested: 1 });
   if (decision.isDenied()) {
      const reason = decision.reason.isRateLimit()
         ? "rate_limited"
         : decision.reason.isEmail()
           ? "email_rejected"
           : decision.reason.isBot()
             ? "bot"
             : "blocked";
      return Response.json({ ok: false, reason }, { status: 429 });
   }

   const posthog = getPosthog();
   if (posthog) {
      posthog.identify({
         distinctId,
         properties: { email, waitlist_source: "landing" },
      });
      posthog.capture({
         distinctId,
         event: "waitlist",
         properties: { email, source: "landing" },
      });
      await posthog.flush().catch(() => {});
   }

   return Response.json({ ok: true });
};
