import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: {
      tsconfigPaths: true,
   },
   test: {
      include: ["./__tests__/**/*.test.ts"],
      env: {
         DATABASE_URL: "postgresql://localhost:5432/test",
         BETTER_AUTH_SECRET: "test-secret-min-32-characters-long-enough",
         BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
         BETTER_AUTH_GOOGLE_CLIENT_ID: "test-google-client-id",
         BETTER_AUTH_GOOGLE_CLIENT_SECRET: "test-google-client-secret",
         STRIPE_SECRET_KEY: "sk_test_dummy",
         STRIPE_WEBHOOK_SECRET: "whsec_test_dummy",
         POSTHOG_HOST: "https://app.posthog.com",
         POSTHOG_KEY: "phc_test_key",
         POSTHOG_PROJECT_ID: "test-project-id",
         POSTHOG_PERSONAL_API_KEY: "phx_test_personal_key",
         RESEND_API_KEY: "re_test_dummy",
         MINIO_ENDPOINT: "localhost:9000",
      },
   },
});
