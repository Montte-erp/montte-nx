import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/bun";
import { env } from "@core/environment/server";
import { getServerLogger } from "@core/logging/server";

const mode = env.ARCJET_ENV === "production" ? "LIVE" : "DRY_RUN";

export const arcjetClient = arcjet({
   key: env.ARCJET_KEY,
   log: getServerLogger({
      LOG_LEVEL: env.LOG_LEVEL,
      POSTHOG_KEY: env.POSTHOG_KEY,
   }),
   rules: [
      shield({ mode }),
      detectBot({
         mode,
         allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:MONITOR"],
      }),
   ],
});

export const arcjetMode = mode;

export { slidingWindow };
