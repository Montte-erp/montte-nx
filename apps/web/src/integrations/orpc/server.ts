import { logs } from "@opentelemetry/api-logs";
import { ORPCError, os } from "@orpc/server";
import type { AuthInstance } from "@core/authentication/server";
import { auth } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import { db } from "@core/database/client";
import { AppError, WebAppError } from "@core/logging/errors";
import type { PostHog } from "@core/posthog/server";
import {
   captureError,
   captureServerEvent,
   identifyUser,
   posthog,
   setGroup,
} from "@core/posthog/server";
import type { StripeClient } from "@core/stripe";
import { stripeClient } from "@core/stripe";
import { sanitizeData } from "@core/utils/sanitization";

// =============================================================================
// Context Types
// =============================================================================

export interface ORPCContext {
   headers: Headers;
   request: Request;
}

export interface ORPCContextWithAuth extends ORPCContext {
   auth: AuthInstance;
   db: DatabaseInstance;
   session: Awaited<ReturnType<AuthInstance["api"]["getSession"]>> | null;
   posthog?: PostHog;
   stripeClient?: StripeClient;
}

/**
 * Context after auth middleware - session is guaranteed to be non-null
 */
export interface ORPCContextAuthenticated extends ORPCContextWithAuth {
   session: NonNullable<ORPCContextWithAuth["session"]>;
   userId: string;
}

/**
 * Context after organization middleware - includes organizationId and teamId
 */
export interface ORPCContextWithOrganization extends ORPCContextAuthenticated {
   organizationId: string;
   teamId: string;
}

// =============================================================================
// Procedures
// =============================================================================

const base = os.$context<ORPCContext>();

const withDeps = base.use(async ({ context, next }) => {
   let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
   try {
      session = await auth.api.getSession({ headers: context.headers });
   } catch {
      session = null;
   }

   return next({
      context: {
         ...context,
         auth,
         db,
         session,
         posthog,
         stripeClient,
      },
   });
});

const withAuth = withDeps.use(async ({ context, next }) => {
   const { session } = context;

   if (!session?.user) {
      throw new ORPCError("UNAUTHORIZED", {
         message: "You must be logged in to access this resource",
      });
   }

   return next({
      context: {
         ...context,
         session,
         userId: session.user.id,
      },
   });
});

/**
 * Procedure requiring active organization and team
 */
const withOrganization = withAuth.use(async ({ context, next }) => {
   const { session } = context;

   const organizationId = session.session.activeOrganizationId;

   if (!organizationId) {
      throw new ORPCError("FORBIDDEN", {
         message: "No active organization selected",
      });
   }

   // Extract team/project ID (now required)
   const teamId = session.session.activeTeamId;

   if (!teamId) {
      throw new ORPCError("FORBIDDEN", {
         message: "No active team selected",
      });
   }

   return next({
      context: {
         ...context,
         organizationId,
         teamId,
      },
   });
});

const withErrorHandling = withOrganization.use(async ({ next }) => {
   try {
      return await next();
   } catch (err) {
      if (err instanceof ORPCError) throw err;
      if (err instanceof AppError) throw WebAppError.fromAppError(err);
      throw WebAppError.internal("Erro interno do servidor.", { cause: err });
   }
});

const otelLogger = logs.getLogger("montte-web-orpc");

const withTelemetry = withErrorHandling.use(
   async ({ context, path, next }, input) => {
      const startDate = new Date();
      const userId = context.session?.user?.id;
      const userEmail = context.session?.user?.email;
      const userName = context.session?.user?.name;
      const hasConsent = context.session?.user?.telemetryConsent;
      const organizationId = context.organizationId;
      const teamId = context.teamId;

      // Read PostHog session ID from frontend header (links logs to session replay)
      const sessionId = context.headers.get("x-posthog-session-id");

      // PostHog identification attributes for OTel log records
      const otelIdentity = {
         posthogDistinctId: userId ?? "anonymous",
         ...(sessionId ? { sessionId } : {}),
         organizationId,
         teamId,
         path: path.join("."),
      };

      // Emit OTel log: request started (linked to user + session replay)
      otelLogger.emit({
         severityText: "info",
         body: `oRPC request: ${path.join(".")}`,
         attributes: otelIdentity,
      });

      // Identify user if consented
      if (userId && hasConsent) {
         identifyUser(userId, {
            email: userEmail,
            name: userName,
         });

         if (organizationId) {
            setGroup(organizationId, {});
         }
      }

      let isSuccess = true;
      let error: Error | null = null;

      try {
         const result = await next();
         return result;
      } catch (err) {
         isSuccess = false;
         error = err instanceof Error ? err : new Error(String(err));
         throw err;
      } finally {
         const durationMs = Date.now() - startDate.getTime();

         // Emit OTel log: request completed/failed (linked to user + session replay)
         otelLogger.emit({
            severityText: isSuccess ? "info" : "error",
            body: isSuccess
               ? `oRPC completed: ${path.join(".")} (${durationMs}ms)`
               : `oRPC error: ${path.join(".")} — ${error?.message}`,
            attributes: {
               ...otelIdentity,
               durationMs,
               success: isSuccess,
               ...(error
                  ? { errorName: error.name, errorMessage: error.message }
                  : {}),
            },
         });

         // Capture PostHog analytics events
         if (userId && hasConsent) {
            try {
               const rootPath = path[0];

               if (!isSuccess && error) {
                  const errorId = crypto.randomUUID();

                  captureError({
                     code: "INTERNAL_SERVER_ERROR",
                     errorId,
                     input: sanitizeData(input),
                     message: error.message,
                     organizationId: organizationId || undefined,
                     path: path.join("."),
                     userId,
                  });
               }

               captureServerEvent({
                  userId,
                  event: "orpc_request",
                  properties: {
                     durationMs,
                     endAt: new Date().toISOString(),
                     input: sanitizeData(input),
                     path: path.join("."),
                     rootPath,
                     startAt: startDate.toISOString(),
                     success: isSuccess,
                     ...(isSuccess
                        ? {}
                        : {
                             errorMessage: error?.message,
                             errorName: error?.name,
                          }),
                  },
                  groups: organizationId
                     ? { organization: organizationId }
                     : undefined,
               });
            } catch {
               // Silently fail telemetry to not affect the main request
            }
         }
      }
   },
);

// =============================================================================
// Exported Procedures
// =============================================================================

/**
 * Public procedure - no authentication required
 * Context includes auth, db, and session (may be null)
 * Use this for publicly accessible endpoints (e.g., shared content, public pages)
 */
export const publicProcedure = withDeps;

/**
 * Authenticated procedure - requires authenticated session (userId only)
 * Use this for endpoints that need a logged-in user but NOT org/team context
 * (e.g., listing organizations, account settings)
 */
export const authenticatedProcedure = withAuth;

/**
 * Protected procedure - requires authenticated session with active organization
 * Use this for all workspace-scoped operations (most endpoints)
 * Automatically provides userId and organizationId in context
 * Includes telemetry middleware for PostHog analytics
 */
export const protectedProcedure = withTelemetry;
