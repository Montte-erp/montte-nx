import { createHash } from "node:crypto";
import { Result, TaggedError } from "better-result";
import { validateEmail } from "@arcjet/node";
import arcjet from "@arcjet/node";
import type { APIContext } from "astro";
import { z } from "zod";

export const prerender = false;

const waitlistSchema = z.object({
   email: z.email("Informe um e-mail válido."),
});

type WaitlistPayload = z.output<typeof waitlistSchema>;

type WaitlistRouteErrorCode =
   | "invalid_payload"
   | "invalid_email"
   | "disposable_email"
   | "email_validation_failed"
   | "request_parsing_failed"
   | "capture_not_allowed"
   | "capture_failed";

const waitlistErrorCatalog: Record<
   WaitlistRouteErrorCode,
   (
      message: string,
      metadata?: string,
   ) => {
      code: WaitlistRouteErrorCode;
      status: 400 | 500;
      message: string;
      metadata?: string;
   }
> = {
   invalid_payload: (message) => ({
      code: "invalid_payload",
      status: 400,
      message,
   }),
   invalid_email: (message) => ({
      code: "invalid_email",
      status: 400,
      message,
   }),
   disposable_email: (message) => ({
      code: "disposable_email",
      status: 400,
      message,
   }),
   email_validation_failed: (message) => ({
      code: "email_validation_failed",
      status: 400,
      message,
   }),
   request_parsing_failed: (message) => ({
      code: "request_parsing_failed",
      status: 400,
      message,
   }),
   capture_not_allowed: (message) => ({
      code: "capture_not_allowed",
      status: 500,
      message,
   }),
   capture_failed: (message, metadata) => ({
      code: "capture_failed",
      status: 500,
      message,
      metadata,
   }),
};

type WaitlistRouteErrorInfo = ReturnType<
   (typeof waitlistErrorCatalog)[keyof typeof waitlistErrorCatalog]
>;

class WaitlistRouteError extends TaggedError("WaitlistRouteError")<{
   source: "landing";
   emailHash?: string;
   error: WaitlistRouteErrorInfo;
   message: string;
}>() {}

const arcjetKey = process.env.ARCJET_KEY?.trim();
const posthogApiKey = process.env.PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY;
const posthogHost = process.env.PUBLIC_POSTHOG_HOST ?? process.env.POSTHOG_HOST;

const disposableFallbackDomains = new Set([
   "mailinator.com",
   "10minutemail.com",
   "yopmail.com",
   "guerrillamail.com",
   "sharklasers.com",
   "temp-mail.org",
   "tempmailaddress.com",
   "fakeinbox.com",
]);

const arcjetClient = arcjetKey
   ? arcjet({
        key: arcjetKey,
        rules: [
           validateEmail({
              mode: "LIVE",
              deny: ["INVALID", "DISPOSABLE"],
           }),
        ],
     })
   : null;

function hashForLog(value: string): string {
   return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function getClientIp(context: APIContext): string | undefined {
   const forwardedFor = context.request.headers.get("x-forwarded-for");
   if (forwardedFor) {
      const [ip] = forwardedFor.split(",").map((item) => item.trim());
      return ip;
   }

   return context.clientAddress || undefined;
}

function mapEmailBlockMessage(types: string[]): string {
   const hasDisposable = types.includes("DISPOSABLE");
   const hasInvalid = types.includes("INVALID");

   if (hasDisposable && hasInvalid) {
      return "Use um e-mail válido e permanente para entrar na lista.";
   }

   if (hasDisposable) {
      return "Este e-mail parece temporário. Use um e-mail permanente.";
   }

   if (hasInvalid) {
      return "Esse e-mail parece incompleto. Ex.: teste@gmail foi rejeitado.";
   }

   return "Não conseguimos validar esse e-mail. Tente outro endereço.";
}

function isLikelyDisposable(email: string): boolean {
   const [, domain] = email.split("@", 2);
   return disposableFallbackDomains.has(domain ?? "");
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
   return Response.json(body, {
      status,
      headers: {
         "content-type": "application/json",
      },
   });
}

function parsePayload(
   value: unknown,
): Result<WaitlistPayload, WaitlistRouteError> {
   const payload = waitlistSchema.safeParse(value);
   if (!payload.success) {
      return Result.err(
         new WaitlistRouteError({
            source: "landing",
            error: waitlistErrorCatalog.invalid_payload(
               payload.error.issues?.[0]?.message ??
                  "Informe um e-mail válido.",
            ),
            message:
               payload.error.issues?.[0]?.message ??
               "Informe um e-mail válido.",
         }),
      );
   }

   return Result.ok({
      ...payload.data,
      email: payload.data.email.toLowerCase().trim(),
   });
}

async function readRequestBody(
   context: APIContext,
): Promise<Result<WaitlistPayload, WaitlistRouteError>> {
   const body = await Result.tryPromise({
      try: () => context.request.json(),
      catch: () =>
         new WaitlistRouteError({
            source: "landing",
            error: waitlistErrorCatalog.request_parsing_failed(
               "Não foi possível processar o envio do formulário.",
            ),
            message: "Não foi possível processar o envio do formulário.",
         }),
   });

   if (Result.isError(body)) {
      return Result.err(body.error);
   }

   return parsePayload(body.value);
}

async function validateWithArcjet(
   context: APIContext,
   email: string,
): Promise<Result<string, WaitlistRouteError>> {
   if (!arcjetClient) {
      if (isLikelyDisposable(email)) {
         return Result.err(
            new WaitlistRouteError({
               source: "landing",
               emailHash: hashForLog(email),
               error: waitlistErrorCatalog.disposable_email(
                  "Este e-mail parece temporário. Use um e-mail permanente.",
               ),
               message:
                  "Este e-mail parece temporário. Use um e-mail permanente.",
            }),
         );
      }

      return Result.ok(email);
   }

   const decision = await Result.tryPromise({
      try: () =>
         arcjetClient.protect(
            {
               headers: Object.fromEntries(context.request.headers.entries()),
               method: context.request.method,
               httpVersion: "1.1",
               socket: {
                  remoteAddress: getClientIp(context),
               },
               url: context.request.url,
            },
            { email },
         ),
      catch: () =>
         new WaitlistRouteError({
            source: "landing",
            emailHash: hashForLog(email),
            error: waitlistErrorCatalog.email_validation_failed(
               "Não conseguimos validar esse e-mail agora. Tente novamente em instantes.",
            ),
            message:
               "Não conseguimos validar esse e-mail agora. Tente novamente em instantes.",
         }),
   });

   if (Result.isError(decision)) {
      console.warn("waitlist_arcjet_error", {
         source: "landing",
         email_hash: hashForLog(email),
         reason: "arcjet_unavailable",
      });
      return Result.ok(email);
   }

   if (decision.value.isDenied() && decision.value.reason.isEmail()) {
      const deniedTypes = decision.value.reason.emailTypes;
      const message = mapEmailBlockMessage(deniedTypes);

      console.warn("waitlist_blocked", {
         source: "landing",
         reason: "arcjet_email",
         email_hash: hashForLog(email),
         types: deniedTypes,
         decision_id: decision.value.id,
      });

      return Result.err(
         new WaitlistRouteError({
            source: "landing",
            emailHash: hashForLog(email),
            error: waitlistErrorCatalog.invalid_email(message),
            message,
         }),
      );
   }

   if (decision.value.isDenied()) {
      console.warn("waitlist_blocked", {
         source: "landing",
         reason: "arcjet_other",
         email_hash: hashForLog(email),
         type: decision.value.reason?.type,
         decision_id: decision.value.id,
      });

      return Result.err(
         new WaitlistRouteError({
            source: "landing",
            emailHash: hashForLog(email),
            error: waitlistErrorCatalog.email_validation_failed(
               "Não conseguimos validar esse e-mail agora. Tente novamente em instantes.",
            ),
            message:
               "Não conseguimos validar esse e-mail agora. Tente novamente em instantes.",
         }),
      );
   }

   return Result.ok(email);
}

async function captureWaitlistLead(
   email: string,
   source: string,
   context: APIContext,
): Promise<Result<void, WaitlistRouteError>> {
   if (!posthogHost || !posthogApiKey) {
      console.warn("waitlist_capture_skipped", {
         source,
         reason: "posthog_env_missing",
         email_hash: hashForLog(email),
      });
      return Result.ok();
   }

   const result = await Result.tryPromise({
      try: async () => {
         const response = await fetch(
            `${posthogHost.replace(/\/$/, "")}/capture/`,
            {
               method: "POST",
               headers: {
                  "content-type": "application/json",
               },
               body: JSON.stringify({
                  api_key: posthogApiKey,
                  event: "waitlist",
                  distinct_id: email,
                  properties: {
                     email,
                     source,
                     waitlist_source: "landing",
                  },
                  timestamp: new Date().toISOString(),
                  ip: getClientIp(context) ?? undefined,
               }),
            },
         );

         if (!response.ok) {
            const details = await response.text().catch(() => "");
            throw new Error(`${response.status} ${details.slice(0, 80)}`);
         }

         return undefined;
      },
      catch: () =>
         new WaitlistRouteError({
            source: "landing",
            emailHash: hashForLog(email),
            error: waitlistErrorCatalog.capture_failed(
               "Não foi possível registrar seu e-mail no momento.",
            ),
            message: "Não foi possível registrar seu e-mail no momento.",
         }),
   });

   if (Result.isError(result)) {
      console.warn("waitlist_capture_failed", {
         source,
         email_hash: hashForLog(email),
         reason: result.error.error.code,
      });
   }

   return result;
}

export async function GET() {
   return jsonResponse(
      {
         ok: false,
         message: "Método não permitido.",
      },
      405,
   );
}

export async function POST(context: APIContext) {
   const result = await Result.gen(async function* () {
      const payload = yield* Result.await(readRequestBody(context));
      const validated = yield* Result.await(
         validateWithArcjet(context, payload.email),
      );
      return Result.ok({ email: validated });
   });

   if (Result.isError(result)) {
      return jsonResponse(
         {
            ok: false,
            message: result.error.message,
            code: result.error.error.code,
         },
         result.error.error.status,
      );
   }

   const captureResult = await captureWaitlistLead(
      result.value.email,
      "landing",
      context,
   );
   if (Result.isError(captureResult)) {
      console.warn("waitlist_capture_blocked_response", {
         source: "landing",
         email_hash: hashForLog(result.value.email),
         reason: captureResult.error.error.code,
      });
   }

   console.info("waitlist_validated", {
      source: "landing",
      email_hash: hashForLog(result.value.email),
   });

   return jsonResponse({
      ok: true,
      email: result.value.email,
   });
}
