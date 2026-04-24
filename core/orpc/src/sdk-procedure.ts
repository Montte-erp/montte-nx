import { os } from "@orpc/server";
import { err, errAsync, fromPromise, ok } from "neverthrow";
import type { ResultAsync } from "neverthrow";
import { getLogger } from "@core/logging/root";
import { WebAppError } from "@core/logging/errors";
import type { AuthInstance } from "@core/authentication/server";
import type { SDKBaseContext, SDKAuthData, SDKAuthError } from "./sdk-context";

const logger = getLogger().child({ module: "sdk-auth" });

export interface SDKProcedureDeps {
   auth: AuthInstance;
}

function resolveApiKey(request: Request): string | null {
   const xApiKey = request.headers.get("X-API-Key");
   if (xApiKey) return xApiKey;
   const sdkApiKey = request.headers.get("sdk-api-key");
   if (sdkApiKey) return sdkApiKey;
   return null;
}

function authenticateRequest(
   auth: AuthInstance,
   request: Request,
): ResultAsync<SDKAuthData, SDKAuthError> {
   const endpoint = new URL(request.url).pathname;
   const apiKeyValue = resolveApiKey(request);

   if (!apiKeyValue) {
      logger.error({ reason: "missing_api_key", endpoint }, "SDK auth failed");
      return errAsync({ code: "MISSING_KEY" } satisfies SDKAuthError);
   }

   return fromPromise(
      auth.api.verifyApiKey({ body: { key: apiKeyValue } }),
      (): SDKAuthError => ({ code: "INVALID_KEY" }),
   ).andThen((result) => {
      if (!result.valid || !result.key) {
         const isRateLimited = result.error?.code === "RATE_LIMITED";
         const code = isRateLimited ? "RATE_LIMITED" : "INVALID_KEY";
         logger.error(
            {
               reason: code.toLowerCase(),
               endpoint,
               organizationId: result.key?.metadata?.organizationId,
               plan: result.key?.metadata?.plan,
               remaining: result.key?.remaining,
            },
            "SDK auth failed",
         );
         return err({ code } satisfies SDKAuthError);
      }

      const { organizationId, teamId } = result.key.metadata ?? {};

      if (!organizationId || typeof organizationId !== "string") {
         return err({ code: "NO_ORGANIZATION" } satisfies SDKAuthError);
      }

      return ok({
         organizationId,
         teamId: typeof teamId === "string" ? teamId : undefined,
         userId: result.key.referenceId ?? undefined,
         plan:
            typeof result.key.metadata?.plan === "string"
               ? result.key.metadata.plan
               : "metered",
         sdkMode:
            result.key.metadata?.sdkMode === "static" ||
            result.key.metadata?.sdkMode === "ssr"
               ? result.key.metadata.sdkMode
               : "static",
         remaining: result.key.remaining ?? null,
         apiKeyType:
            result.key.metadata?.apiKeyType === "public" ||
            result.key.metadata?.apiKeyType === "private"
               ? result.key.metadata.apiKeyType
               : "private",
      } satisfies SDKAuthData);
   });
}

function authErrorToWebAppError(error: SDKAuthError): WebAppError {
   switch (error.code) {
      case "MISSING_KEY":
         return new WebAppError("UNAUTHORIZED", {
            message: "Missing API Key",
            source: "sdk",
         });
      case "RATE_LIMITED":
         return new WebAppError("TOO_MANY_REQUESTS", {
            message: "Rate limit exceeded",
            source: "sdk",
         });
      case "INVALID_KEY":
         return new WebAppError("UNAUTHORIZED", {
            message: "Invalid API Key",
            source: "sdk",
         });
      case "NO_ORGANIZATION":
         return new WebAppError("FORBIDDEN", {
            message: "API key has no associated organization",
            source: "sdk",
         });
   }
}

export function createSDKProcedure(deps: SDKProcedureDeps) {
   const base = os.$context<SDKBaseContext>();

   return base.use(async ({ context, next }) => {
      const authResult = await authenticateRequest(deps.auth, context.request);
      if (authResult.isErr()) {
         throw authErrorToWebAppError(authResult.error);
      }

      const {
         organizationId,
         teamId,
         userId,
         plan,
         sdkMode,
         remaining,
         apiKeyType,
      } = authResult.value;

      return next({
         context: {
            ...context,
            organizationId,
            teamId,
            plan,
            sdkMode,
            remaining,
            userId,
            apiKeyType,
         },
      });
   });
}
