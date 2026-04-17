import dayjs from "dayjs";
import { logs } from "@opentelemetry/api-logs";
import { ORPCError, os } from "@orpc/server";
import type { AuthInstance } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import { AppError, WebAppError } from "@core/logging/errors";
import type { PostHog } from "@core/posthog/server";
import {
   captureError,
   captureServerEvent,
   identifyUser,
   setGroup,
} from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import type { StripeClient } from "@core/stripe";
import { sanitizeData } from "@core/utils/sanitization";
import { createJobPublisher } from "@packages/notifications/publisher";
import {
   auth,
   db,
   posthog,
   redis,
   stripeClient,
} from "@/integrations/singletons";

const jobPublisher = createJobPublisher(redis);

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
   redis?: Redis;
   jobPublisher: ReturnType<typeof createJobPublisher>;
}

export interface ORPCContextAuthenticated extends ORPCContextWithAuth {
   session: NonNullable<ORPCContextWithAuth["session"]>;
   userId: string;
}

export interface ORPCContextWithOrganization extends ORPCContextAuthenticated {
   organizationId: string;
   teamId: string;
}

const base = os.$context<ORPCContext>();

const withDeps = base.use(async ({ context, next }) => {
   const ctx = context as ORPCContext & Partial<ORPCContextWithAuth>;

   let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
   if (ctx.session !== undefined) {
      session = ctx.session;
   } else {
      try {
         session = await auth.api.getSession({ headers: context.headers });
      } catch {
         session = null;
      }
   }

   return next({
      context: {
         ...context,
         auth: ctx.auth ?? auth,
         db: ctx.db ?? db,
         session,
         posthog: ctx.posthog ?? posthog,
         stripeClient: ctx.stripeClient ?? stripeClient,
         redis: ctx.redis ?? redis,
         jobPublisher: ctx.jobPublisher ?? jobPublisher,
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

const withOrganization = withAuth.use(async ({ context, next }) => {
   const { session } = context;

   const organizationId = session.session.activeOrganizationId;

   if (!organizationId) {
      throw new ORPCError("FORBIDDEN", {
         message: "No active organization selected",
      });
   }

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
      const startDate = dayjs().toDate();
      const userId = context.session?.user?.id;
      const userEmail = context.session?.user?.email;
      const userName = context.session?.user?.name;
      const organizationId = context.organizationId;
      const teamId = context.teamId;

      const sessionId = context.headers.get("x-posthog-session-id");

      const otelIdentity = {
         posthogDistinctId: userId ?? "anonymous",
         ...(sessionId ? { sessionId } : {}),
         organizationId,
         teamId,
         path: path.join("."),
      };

      otelLogger.emit({
         severityText: "info",
         body: `oRPC request: ${path.join(".")}`,
         attributes: otelIdentity,
      });

      if (userId && context.posthog) {
         identifyUser(context.posthog, userId, {
            email: userEmail,
            name: userName,
         });

         if (organizationId) {
            setGroup(context.posthog, organizationId, {});
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

         if (userId && context.posthog) {
            try {
               const rootPath = path[0];

               if (!isSuccess && error) {
                  const errorId = crypto.randomUUID();

                  captureError(context.posthog, {
                     code: "INTERNAL_SERVER_ERROR",
                     errorId,
                     input: sanitizeData(input),
                     message: error.message,
                     organizationId: organizationId || undefined,
                     path: path.join("."),
                     userId,
                  });
               }

               captureServerEvent(context.posthog, {
                  userId,
                  event: "orpc_request",
                  properties: {
                     durationMs,
                     endAt: dayjs().toISOString(),
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

export const publicProcedure = withDeps;

export const authenticatedProcedure = withAuth;

export const protectedProcedure = withTelemetry;
