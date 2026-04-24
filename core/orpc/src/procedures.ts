import dayjs from "dayjs";
import { fromPromise, fromThrowable } from "neverthrow";
import { logs } from "@opentelemetry/api-logs";
import { ORPCError, os } from "@orpc/server";
import type { BuilderWithMiddlewares } from "@orpc/server";
import type { AnySchema } from "@orpc/contract";
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
import type {
   ORPCContext,
   ORPCContextAuthenticated,
   ORPCContextWithAuth,
   ORPCContextWithOrganization,
} from "./context";

export interface ORPCProcedureDeps {
   auth: AuthInstance;
   db: DatabaseInstance;
   posthog: PostHog;
   redis: Redis;
   stripeClient: StripeClient;
   workflowClient: Promise<DBOSClient>;
   jobPublisher: ReturnType<typeof createJobPublisher>;
}

const otelLogger = logs.getLogger("montte-web-orpc");

export interface ORPCProcedures {
   publicProcedure: BuilderWithMiddlewares<
      ORPCContext,
      ORPCContextWithAuth,
      AnySchema,
      AnySchema,
      Record<never, never>,
      Record<never, never>
   >;
   authenticatedProcedure: BuilderWithMiddlewares<
      ORPCContext,
      ORPCContextAuthenticated,
      AnySchema,
      AnySchema,
      Record<never, never>,
      Record<never, never>
   >;
   protectedProcedure: BuilderWithMiddlewares<
      ORPCContext,
      ORPCContextWithOrganization,
      AnySchema,
      AnySchema,
      Record<never, never>,
      Record<never, never>
   >;
}

export function createORPCProcedures(deps: ORPCProcedureDeps): ORPCProcedures {
   const base = os.$context<ORPCContext>();

   const withDeps = base.use(async ({ context, next }) => {
      const sessionResult = await fromPromise(
         (async () => deps.auth.api.getSession({ headers: context.headers }))(),
         () => null,
      );

      return next({
         context: {
            ...context,
            auth: deps.auth,
            db: deps.db,
            session: sessionResult.isOk() ? sessionResult.value : null,
            posthog: deps.posthog,
            stripeClient: deps.stripeClient,
            redis: deps.redis,
            workflowClient: await deps.workflowClient,
            jobPublisher: deps.jobPublisher,
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
         context: { ...context, organizationId, teamId },
      });
   });

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
            (err): Error =>
               err instanceof Error ? err : new Error(String(err)),
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
            const err = result.error;
            if (err instanceof AppError) throw WebAppError.fromAppError(err);
            throw err;
         }
         return result.value;
      },
   );

   return {
      publicProcedure: withDeps,
      authenticatedProcedure: withAuth,
      protectedProcedure: withTelemetry,
   };
}
