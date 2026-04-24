import { env } from "@core/environment/worker";
import { initLogger, getLogger } from "@core/logging/root";
import { initOtel, shutdownOtel } from "@core/logging/otel";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog } from "@core/posthog/server";
import { createStripeClient } from "@core/stripe";
import { createResendClient } from "@core/transactional/utils";
import { launchDBOS } from "@packages/workflows/setup";
import { setupBillingWorkflows } from "@modules/billing/workflows";

initOtel({
   serviceName: "montte-worker",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});

initLogger({ name: "montte-worker", level: env.LOG_LEVEL });

const logger = getLogger();
const db = createDb({ databaseUrl: env.DATABASE_URL });
const redis = createRedis(env.REDIS_URL);
const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
const stripeClient = createStripeClient(env.STRIPE_SECRET_KEY);
const resendClient = createResendClient(env.RESEND_API_KEY);

logger.info("Starting worker");

setupBillingWorkflows({ redis, resendClient, workerConcurrency: 10 });

launchDBOS({
   db,
   redis,
   posthog,
   stripeClient,
   resendClient,
   systemDatabaseUrl: env.DATABASE_URL,
   logLevel: env.LOG_LEVEL,
   onShutdown: async () => {
      await posthog.shutdown();
      redis.disconnect();
      await shutdownOtel();
   },
});
