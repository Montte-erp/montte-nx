import dayjs from "dayjs";
import { err, fromPromise, fromThrowable, ok } from "neverthrow";
import { logs } from "@opentelemetry/api-logs";
import { ORPCError, os } from "@orpc/server";
import { createAuth } from "@core/authentication/server";
import { createHyprpay } from "@core/hyprpay/client";
import { createDb } from "@core/database/client";
import { env } from "@core/environment/web";
import {
   captureError,
   captureServerEvent,
   createPostHog,
   identifyUser,
   setGroup,
} from "@core/posthog/server";
import { createRedis } from "@core/redis/connection";
import { AppError, WebAppError } from "@core/logging/errors";
import { createResendClient } from "@core/transactional/utils";
import { createWorkflowClient } from "@core/dbos/client";
import { sanitizeData } from "@core/utils/sanitization";
import type {
   ORPCContext,
   ORPCContextAuthenticated,
   ORPCContextWithAuth,
   ORPCContextWithOrganization,
} from "./context";

const db = createDb({ databaseUrl: env.DATABASE_URL });
const redis = createRedis(env.REDIS_URL);
const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
const resendClient = createResendClient(env.RESEND_API_KEY);
const hyprpayClient = createHyprpay(env.HYPRPAY_API_KEY);
const auth = createAuth({
   db,
   redis,
   posthog,
   resendClient,
   hyprpayClient,
   env,
});
const workflowClient = createWorkflowClient(env.DATABASE_URL);

const otelLogger = logs.getLogger("montte-web-orpc");

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
         redis,
         workflowClient: await workflowClient,
         hyprpayClient,
      },
   });
});

const withAuth = withDeps.use(({ context, next }) => {
   const { session } = context;
   return (
      session?.user
         ? ok(session)
         : err(
              new ORPCError("UNAUTHORIZED", {
                 message: "You must be logged in to access this resource",
              }),
           )
   ).match(
      (s) => next({ context: { ...context, session: s, userId: s.user.id } }),
      (e) => Promise.reject(e),
   );
});

const withOrganization = withAuth.use(({ context, next }) => {
   const { session } = context;
   const organizationId = session.session.activeOrganizationId;
   const teamId = session.session.activeTeamId;
   return (
      !organizationId
         ? err(
              new ORPCError("FORBIDDEN", {
                 message: "No active organization selected",
              }),
           )
         : !teamId
           ? err(
                new ORPCError("FORBIDDEN", {
                   message: "No active team selected",
                }),
             )
           : ok({ organizationId, teamId })
   ).match(
      ({ organizationId, teamId }) =>
         next({ context: { ...context, organizationId, teamId } }),
      (e) => Promise.reject(e),
   );
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

      return result.match(
         (value) => value,
         (e) =>
            Promise.reject(
               e instanceof AppError ? WebAppError.fromAppError(e) : e,
            ),
      );
   },
);

const withBilling = withTelemetry.use(async ({ context, path, next }) => {
   const result = await next({});
   context.hyprpayClient.usage
      .ingest({
         customerId: context.organizationId,
         meterId: path.join("."),
         quantity: 1,
         idempotencyKey: crypto.randomUUID(),
      })
      .then((r) => {
         if (r.isErr())
            otelLogger.emit({
               severityText: "error",
               body: "billing ingest failed",
               attributes: {
                  "error.message": r.error.message,
                  path: path.join("."),
                  organizationId: context.organizationId,
               },
            });
      });
   return result;
});

export type {
   ORPCContext,
   ORPCContextWithAuth,
   ORPCContextAuthenticated,
   ORPCContextWithOrganization,
};

export const publicProcedure = withDeps;
export const authenticatedProcedure = withAuth;
export const protectedProcedure = withTelemetry;
export const billableProcedure = withBilling;
