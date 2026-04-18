import { env } from "@core/environment/worker";
import { initLogger, getLogger } from "@core/logging/root";
import { initOtel, shutdownOtel } from "@core/logging/otel";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog } from "@core/posthog/server";
import { createStripeClient } from "@core/stripe";
import { launchDBOS } from "@packages/workflows/setup";

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

logger.info("Starting worker");

launchDBOS({
   db,
   redis,
   posthog,
   stripeClient,
   systemDatabaseUrl: env.DATABASE_URL,
   logLevel: env.LOG_LEVEL,
   onShutdown: async () => {
      posthog.shutdown();
      redis.disconnect();
      await shutdownOtel();
   },
});
