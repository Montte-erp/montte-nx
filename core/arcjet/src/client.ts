import arcjet, { detectBot, shield, slidingWindow } from "arcjet";
import { env } from "@core/environment/server";

const mode = env.ARCJET_ENV === "production" ? "LIVE" : "DRY_RUN";

export const arcjetClient = arcjet({
   key: env.ARCJET_KEY,
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
