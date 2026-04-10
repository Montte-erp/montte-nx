import { ORPCError, os } from "@orpc/server";
import type { PostHog } from "@core/posthog/server";
import { db } from "../singletons";
import { authenticateRequest, checkDomainAllowed } from "../utils/sdk-auth";
import type { AuthError } from "../utils/sdk-auth";

interface BaseContext {
   db: typeof db;
   posthog: PostHog;
   request: Request;
}

interface SdkContext extends BaseContext {
   organizationId: string;
   teamId?: string;
   plan: string;
   sdkMode: "static" | "ssr";
   remaining: number | null;
   userId?: string;
   apiKeyType: "public" | "private";
}

function authErrorToOrpc(error: AuthError) {
   switch (error.code) {
      case "MISSING_KEY":
         return new ORPCError("UNAUTHORIZED", { message: "Missing API Key" });
      case "RATE_LIMITED":
         return new ORPCError("TOO_MANY_REQUESTS", {
            message: "Rate limit exceeded",
         });
      case "INVALID_KEY":
         return new ORPCError("UNAUTHORIZED", { message: "Invalid API Key" });
      case "NO_ORGANIZATION":
         return new ORPCError("FORBIDDEN", {
            message: "API key has no associated organization",
         });
   }
}

const baseProcedure = os.$context<BaseContext>();

export const sdkProcedure = baseProcedure.use(async ({ context, next }) => {
   const { request } = context;

   const authResult = await authenticateRequest(request);
   if (authResult.isErr()) {
      throw authErrorToOrpc(authResult.error);
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

   const domainResult = await checkDomainAllowed(request, teamId, db);
   if (domainResult.isErr()) {
      throw new ORPCError("FORBIDDEN", { message: "Origin not allowed" });
   }

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

export const router = os.router;
export type { SdkContext };
