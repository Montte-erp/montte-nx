import { createAuth } from "@core/authentication/server";
import { createDb } from "@core/database/client";
import { env } from "@core/environment/web";
import { createPostHog } from "@core/posthog/server";
import { createRedis } from "@core/redis/connection";
import { createStripeClient } from "@core/stripe";
import { createResendClient } from "@core/transactional/utils";
import { createWorkflowClient } from "@core/dbos/client";
import { createJobPublisher } from "@packages/notifications/publisher";
import { createORPCProcedures } from "./procedures";

const db = createDb({ databaseUrl: env.DATABASE_URL });
const redis = createRedis(env.REDIS_URL);
const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
const stripeClient = createStripeClient(env.STRIPE_SECRET_KEY);
const resendClient = createResendClient(env.RESEND_API_KEY);
const auth = createAuth({
   db,
   redis,
   posthog,
   stripeClient,
   resendClient,
   env,
});
const workflowClient = createWorkflowClient(env.DATABASE_URL);
const jobPublisher = createJobPublisher(redis);

export const { publicProcedure, authenticatedProcedure, protectedProcedure } =
   createORPCProcedures({
      auth,
      db,
      posthog,
      redis,
      stripeClient,
      workflowClient,
      jobPublisher,
   });
