import dayjs from "dayjs";
import { Result } from "better-result";
import { z } from "zod";
import { os } from "@orpc/server";
import { createAuth } from "@core/authentication/server";
import { createDb } from "@core/database/client";
import { env } from "@core/environment/web";
import { createS3Client } from "@core/files/client";
import {
   createPostHog,
   createPromptsClient,
   identifyUser,
   setGroup,
} from "@core/posthog/server";
import { createNotificationsClient } from "@core/notifications/client";
import { createRedis } from "@core/redis/connection";
import { AppError, WebAppError } from "@core/logging/errors";
import { createWorkflowClient } from "@core/dbos/client";
import type {
   ORPCContext,
   ORPCContextAuthenticated,
   ORPCContextWithAuth,
   ORPCContextWithOrganization,
} from "./context";

const db = createDb({ databaseUrl: env.DATABASE_URL });
const redis = createRedis(env.REDIS_URL);
const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
const posthogPrompts = createPromptsClient({
   personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
   projectApiKey: env.POSTHOG_KEY,
   host: env.POSTHOG_HOST,
});
const notificationsClient = createNotificationsClient({
   resendApiKey: env.RESEND_API_KEY,
});
const auth = createAuth({
   db,
   redis,
   posthog,
   notificationsClient,
   env,
});
const workflowClient = createWorkflowClient(env.DATABASE_URL);
const s3Client = createS3Client({
   endpointUrl: env.AWS_ENDPOINT_URL,
   accessKeyId: env.AWS_ACCESS_KEY_ID,
   secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
   region: env.AWS_DEFAULT_REGION,
});

export async function buildWebContext(
   request: Request,
   log: ORPCContext["log"],
): Promise<ORPCContextWithOrganization | null> {
   const session = await auth.api.getSession({ headers: request.headers });
   if (!session?.user) return null;
   const organizationId = session.session.activeOrganizationId;
   const teamId = session.session.activeTeamId;
   if (!organizationId || !teamId) return null;
   return {
      headers: request.headers,
      request,
      log,
      auth,
      db,
      session,
      userId: session.user.id,
      organizationId,
      teamId,
      posthog,
      posthogPrompts,
      redis,
      workflowClient: await workflowClient,
      s3Client,
   };
}

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
      const result = await Result.gen(async function* () {
         const verified = yield* Result.await(
            Result.tryPromise({
               try: () => auth.api.verifyApiKey({ body: { key: apiKeyValue } }),
               catch: () => WebAppError.unauthorized("API key inválida."),
            }),
         );
         if (!verified?.valid || !verified.key) {
            return Result.err(WebAppError.unauthorized("API key inválida."));
         }

         const parsed = apiKeyMetadataSchema.safeParse(verified.key.metadata);
         if (!parsed.success) {
            return Result.err(
               WebAppError.badRequest("Metadata da API key inválida."),
            );
         }

         const apiKeyHeaders = new Headers();
         apiKeyHeaders.set("x-api-key", apiKeyValue);

         const session = yield* Result.await(
            Result.tryPromise({
               try: () => auth.api.getSession({ headers: apiKeyHeaders }),
               catch: () =>
                  WebAppError.unauthorized(
                     "Falha ao resolver sessão da API key.",
                  ),
            }),
         );
         if (!session?.user) {
            return Result.err(
               WebAppError.unauthorized("API key sem sessão associada."),
            );
         }
         if (session.user.id !== verified.key.referenceId) {
            return Result.err(
               WebAppError.unauthorized("API key não pertence à sessão."),
            );
         }

         return Result.ok({
            ...session,
            session: {
               ...session.session,
               activeOrganizationId: parsed.data.organizationId,
               activeTeamId: parsed.data.teamId ?? session.session.activeTeamId,
            },
         });
      });
      if (Result.isError(result)) throw result.error;

      return next({
         context: {
            ...context,
            auth,
            db,
            session: result.value,
            posthog,
            posthogPrompts,
            redis,
            workflowClient: await workflowClient,
            s3Client,
         },
      });
   }

   const cookieSession = await Result.tryPromise({
      try: () => auth.api.getSession({ headers: context.headers }),
      catch: () => WebAppError.internal("Falha ao resolver sessão."),
   });
   if (Result.isError(cookieSession)) throw cookieSession.error;

   return next({
      context: {
         ...context,
         auth,
         db,
         session: cookieSession.value,
         posthog,
         posthogPrompts,
         redis,
         workflowClient: await workflowClient,
         s3Client,
      },
   });
});

const withAuth = withDeps.use(({ context, next }) => {
   const { session } = context;
   if (!session?.user) {
      throw WebAppError.unauthorized(
         "Você precisa estar autenticado para acessar este recurso.",
      );
   }
   return next({
      context: { ...context, session, userId: session.user.id },
   });
});

const withOrganization = withAuth.use(({ context, next }) => {
   const { session } = context;
   const organizationId = session.session.activeOrganizationId;
   const teamId = session.session.activeTeamId;
   if (!organizationId) {
      throw WebAppError.forbidden("Nenhuma organização ativa selecionada.");
   }
   if (!teamId) {
      throw WebAppError.forbidden("Nenhum time ativo selecionado.");
   }
   return next({ context: { ...context, organizationId, teamId } });
});

function toError(error: unknown): Error {
   return error instanceof Error ? error : new Error(String(error));
}

const withLogger = withOrganization.use(
   async ({ context, path, next }, input) => {
      const startDate = dayjs().toDate();
      const userId = context.session?.user?.id;
      const organizationId = context.organizationId;
      const teamId = context.teamId;
      const sessionId = context.headers.get("x-posthog-session-id");
      const orpcPath = path.join(".");

      const eventIdentity = {
         posthogDistinctId: userId ?? "anonymous",
         ...(sessionId ? { sessionId } : {}),
         organizationId,
         teamId,
         path: orpcPath,
      };

      context.log.set({
         orpc: {
            path: orpcPath,
            rootPath: path[0],
         },
         userId,
         ...eventIdentity,
      });

      const result = await Result.tryPromise({
         try: async () => next(),
         catch: toError,
      });

      const durationMs = Date.now() - startDate.getTime();
      const isSuccess = Result.isOk(result);
      const error = Result.isError(result) ? result.error : null;

      context.log.set({
         orpc: {
            path: orpcPath,
            rootPath: path[0],
            durationMs,
            endAt: dayjs().toISOString(),
            success: isSuccess,
            input,
            ...(error
               ? { errorName: error.name, errorMessage: error.message }
               : {}),
         },
      });
      context.log.emit();

      if (Result.isError(result)) {
         throw result.error instanceof AppError
            ? WebAppError.fromAppError(result.error)
            : result.error;
      }

      return result.value;
   },
);

const withTelemetry = withLogger.use(async ({ context, next }) => {
   const userId = context.session.user.id;
   const userEmail = context.session.user.email;
   const userName = context.session.user.name;
   const organizationId = context.organizationId;

   const telemetry = Result.try({
      try: () => {
         identifyUser(context.posthog, userId, {
            email: userEmail,
            name: userName,
         });
         setGroup(context.posthog, organizationId, {});

         context.log.set({
            posthog: {
               distinctId: userId,
               group: { organization: organizationId },
            },
         });
      },
      catch: toError,
   });

   if (telemetry.isErr()) {
      context.log.warn("PostHog telemetry failed", {
         posthog: {
            errorName: telemetry.error.name,
            errorMessage: telemetry.error.message,
         },
      });
   }

   return next();
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
export const billableProcedure = withTelemetry;
