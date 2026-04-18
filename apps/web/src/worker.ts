import { env } from "@core/environment/web";
import { getWorkerLogger } from "@core/logging/worker";
import { initOtel } from "@core/logging/otel";
import { launchDBOS } from "@packages/workflows/setup";
import { db, redis, posthog, stripeClient } from "@/integrations/singletons";

initOtel({
   serviceName: "montte-worker",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});

const logger = getWorkerLogger({
   LOG_LEVEL: env.LOG_LEVEL,
   POSTHOG_KEY: env.POSTHOG_KEY,
});

logger.info("Starting worker");

launchDBOS({
   db,
   redis,
   posthog,
   stripeClient,
   systemDatabaseUrl: env.DATABASE_URL,
   logLevel: env.LOG_LEVEL,
});
