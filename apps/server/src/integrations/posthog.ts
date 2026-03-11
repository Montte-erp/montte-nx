import { env } from "@core/environment/server";
import { getElysiaPosthogConfig } from "@core/posthog/server";

export const posthog = getElysiaPosthogConfig({
   POSTHOG_HOST: env.POSTHOG_HOST,
   POSTHOG_KEY: env.POSTHOG_KEY,
});
