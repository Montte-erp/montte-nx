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
         POSTHOG_PROJECT_ID: "1",
         POSTHOG_PERSONAL_API_KEY: "phx_test",
         STRIPE_SECRET_KEY: "sk_test_xxx",
         STRIPE_WEBHOOK_SECRET: "whsec_test",
         RESEND_API_KEY: "re_test_xxx",
         BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
         JWT_SECRET: "test-jwt-secret-at-least-32-characters",
         BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
         BETTER_AUTH_GOOGLE_CLIENT_ID: "test-client-id",
         BETTER_AUTH_GOOGLE_CLIENT_SECRET: "test-client-secret",
         HYPRPAY_API_KEY: "hyprpay_test",
         MINIO_ENDPOINT: "http://localhost:9000",
         NODE_ENV: "test",
         LOG_LEVEL: "error",
      },
   },
});
