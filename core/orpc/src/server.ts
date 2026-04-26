import dayjs from "dayjs";
import { err, fromPromise, fromThrowable, ok } from "neverthrow";
import { z } from "zod";
import { logs } from "@opentelemetry/api-logs";
import { ORPCError, onSuccess, os } from "@orpc/server";
import { createAuth } from "@core/authentication/server";
import { createHyprpay } from "@core/hyprpay/client";
import { ingestUsageEvent } from "@core/hyprpay/usage";
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

export type BillableMeta = { billableEvent?: string };

const base = os.$context<ORPCContext>().$meta<BillableMeta>({});

const apiKeyMetadataSchema = z.object({
   organizationId: z.string().min(1),
   teamId: z.string().min(1).nullish(),
});

const withDeps = base.use(async ({ context, next }) => {
   const apiKeyValue =
      context.headers.get("x-api-key") ?? context.headers.get("sdk-api-key");

   if (apiKeyValue) {
      const result = await fromPromise(
         auth.api.verifyApiKey({ body: { key: apiKeyValue } }),
         () => WebAppError.unauthorized("API key inválida."),
      )
         .andThen((v) =>
            v?.valid && v.key
               ? ok(v.key)
               : err(WebAppError.unauthorized("API key inválida.")),
         )
         .andThen((key) => {
            const parsed = apiKeyMetadataSchema.safeParse(key.metadata);
            return parsed.success
               ? ok(parsed.data)
               : err(WebAppError.badRequest("Metadata da API key inválida."));
         })
         .andThen((meta) =>
            fromPromise(auth.api.getSession({ headers: context.headers }), () =>
               WebAppError.unauthorized("Falha ao resolver sessão da API key."),
            ).andThen((s) =>
               s?.user
                  ? ok({
                       ...s,
                       session: {
                          ...s.session,
                          activeOrganizationId: meta.organizationId,
                          activeTeamId: meta.teamId ?? s.session.activeTeamId,
                       },
                    })
                  : err(
                       WebAppError.unauthorized(
                          "API key sem sessão associada.",
                       ),
                    ),
            ),
         );
      if (result.isErr()) throw result.error;

      return next({
         context: {
            ...context,
            auth,
            db,
            session: result.value,
            posthog,
            redis,
            workflowClient: await workflowClient,
            hyprpayClient,
         },
      });
   }

   const cookieSession = await fromPromise(
      auth.api.getSession({ headers: context.headers }),
      () => WebAppError.internal("Falha ao resolver sessão."),
   );
   if (cookieSession.isErr()) throw cookieSession.error;

   return next({
      context: {
         ...context,
         auth,
         db,
         session: cookieSession.value,
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

const withBilling = withTelemetry.use(
   onSuccess(async (_result, { context, path, procedure }) => {
      const eventName = procedure["~orpc"].meta.billableEvent;
      if (!eventName) return;

      // Each successful procedure call is a distinct billable event; the
      // usage_events unique index on (teamId, idempotencyKey) prevents
      // double-counting on TanStack Query retries (failed calls never reach
      // onSuccess).
      const result = await ingestUsageEvent({
         db: context.db,
         teamId: context.teamId,
         externalId: context.organizationId,
         eventName,
         quantity: 1,
         idempotencyKey: crypto.randomUUID(),
         properties: { path: path.join(".") },
      });

      if (result.isErr()) {
         otelLogger.emit({
            severityText: "warn",
            body: "billable event ingest failed",
            attributes: {
               "error.message": result.error.message,
               path: path.join("."),
               eventName,
               organizationId: context.organizationId,
               teamId: context.teamId,
            },
         });
         return;
      }

      if (!result.value.ingested) {
         otelLogger.emit({
            severityText: "debug",
            body: "billable event skipped — no meter configured",
            attributes: {
               path: path.join("."),
               eventName,
               organizationId: context.organizationId,
               teamId: context.teamId,
            },
         });
      }
   }),
);

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
