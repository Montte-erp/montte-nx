import type { betterAuth } from "better-auth";
import { createAuth } from "@core/authentication/server";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog } from "@core/posthog/server";
import { createResendClient } from "@core/transactional/utils";
import { createHyprpay } from "@core/hyprpay/client";
import { env } from "@core/environment/web";

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

export default auth as unknown as ReturnType<typeof betterAuth>;
