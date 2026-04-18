import dayjs from "dayjs";
import { fromPromise, fromThrowable } from "neverthrow";
import { logs } from "@opentelemetry/api-logs";
import { ORPCError, os } from "@orpc/server";
import type { AuthInstance } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import {
   captureError,
   captureServerEvent,
   identifyUser,
   setGroup,
} from "@core/posthog/server";
import { AppError, WebAppError } from "@core/logging/errors";
import type { Redis } from "@core/redis/connection";
import type { StripeClient } from "@core/stripe";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { sanitizeData } from "@core/utils/sanitization";
import { createJobPublisher } from "@packages/notifications/publisher";
import {
   auth,
   db,
   posthog,
   redis,
   stripeClient,
   workflowClient,
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
   posthog: PostHog;
   stripeClient: StripeClient;
   redis: Redis;
   workflowClient: DBOSClient;
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
   const sessionResult = await fromPromise(
      (async () => auth.api.getSession({ headers: context.headers }))(),
      () => null,
   );

   return next({
      context: {
         ...context,
         auth,
         db,
         session: sessionResult.isOk() ? sessionResult.value : null,
         posthog,
         stripeClient,
         redis,
         workflowClient: await workflowClient,
         jobPublisher,
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

const otelLogger = logs.getLogger("montte-web-orpc");

const withTelemetry = withOrganization.use(
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
         if (organizationId) setGroup(context.posthog, organizationId, {});
      }

      const result = await fromPromise(
         (async () => next())(),
         (err): Error => (err instanceof Error ? err : new Error(String(err))),
      );

      const durationMs = Date.now() - startDate.getTime();
      const isSuccess = result.isOk();
      const error = result.isErr() ? result.error : null;

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
         const safeCapture = fromThrowable(() => {
            const rootPath = path[0];
            if (!isSuccess && error) {
               captureError(context.posthog!, {
                  code: "INTERNAL_SERVER_ERROR",
                  errorId: crypto.randomUUID(),
                  input: sanitizeData(input),
                  message: error.message,
                  organizationId: organizationId || undefined,
                  path: path.join("."),
                  userId: userId!,
               });
            }
            captureServerEvent(context.posthog!, {
               userId: userId!,
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
         });
         safeCapture();
      }

      if (result.isErr()) {
         const error = result.error;
         if (error instanceof AppError) throw WebAppError.fromAppError(error);
         throw error;
      }
      return result.value;
   },
);

export const publicProcedure = withDeps;

export const authenticatedProcedure = withAuth;

export const protectedProcedure = withTelemetry;
