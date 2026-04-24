import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: {
      tsconfigPaths: true,
   },
   test: {
      include: ["./__tests__/**/*.test.ts"],
      hookTimeout: 30_000,
      env: {
         DATABASE_URL: "postgresql://test:test@localhost:5432/test",
         REDIS_URL: "redis://localhost:6379",
         POSTHOG_HOST: "https://us.i.posthog.com",
         POSTHOG_KEY: "phc_test",
         POSTHOG_PERSONAL_API_KEY: "phx_test",
         STRIPE_SECRET_KEY: "sk_test_xxx",
         RESEND_API_KEY: "re_test_xxx",
         NODE_ENV: "test",
         LOG_LEVEL: "error",
      },
   },
});
