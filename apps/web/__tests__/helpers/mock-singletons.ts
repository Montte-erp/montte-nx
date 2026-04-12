import { vi } from "vitest";

vi.mock("@core/environment/web", () => ({
   env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      BETTER_AUTH_SECRET: "test-secret-key-min-32-characters-long-xxx",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
      BETTER_AUTH_GOOGLE_CLIENT_ID: "test-google-client-id",
      BETTER_AUTH_GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      STRIPE_SECRET_KEY: "sk_test_xxx",
      STRIPE_WEBHOOK_SECRET: "whsec_test_xxx",
      POSTHOG_HOST: "https://us.i.posthog.com",
      POSTHOG_KEY: "phc_test",
      POSTHOG_PROJECT_ID: "12345",
      RESEND_API_KEY: "re_test_xxx",
      MINIO_ENDPOINT: "localhost:9000",
      NODE_ENV: "test",
      LOG_LEVEL: "info",
   },
}));

vi.mock("@/integrations/otel/init");

vi.mock("@dbos-inc/dbos-sdk", () => ({
   DBOS: {
      workflow:
         () =>
         (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
            descriptor,
      step:
         () =>
         (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
            descriptor,
      startWorkflow: vi
         .fn()
         .mockReturnValue({ run: vi.fn().mockResolvedValue(undefined) }),
      setConfig: vi.fn(),
      launch: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
   },
}));

vi.mock("@/integrations/dbos/workflows", () => ({
   DeriveKeywordsWorkflow: { run: vi.fn().mockResolvedValue(undefined) },
   BackfillKeywordsWorkflow: { run: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/integrations/dbos/init", () => ({
   launchDBOS: vi.fn(),
}));

vi.mock("@/integrations/singletons", async () => {
   const { testStore } = await import("./test-store");

   return {
      get db() {
         return testStore.db;
      },
      get auth() {
         return testStore.auth;
      },
      redis: {
         get: vi.fn(),
         set: vi.fn(),
         del: vi.fn(),
         incr: vi.fn(),
         pexpire: vi.fn(),
         ping: vi.fn(),
         quit: vi.fn(),
         on: vi.fn(),
      },
      posthog: {
         capture: vi.fn(),
         identify: vi.fn(),
         groupIdentify: vi.fn(),
         shutdown: vi.fn(),
         isFeatureEnabled: vi.fn(),
         getFeatureFlag: vi.fn(),
         getAllFlags: vi.fn(),
         getAllFlagsAndPayloads: vi.fn(),
         getFeatureFlagPayload: vi.fn(),
      },
      stripeClient: undefined,
      minioClient: {
         putObject: vi.fn(),
         getObject: vi.fn(),
         statObject: vi.fn(),
         bucketExists: vi.fn().mockResolvedValue(true),
         presignedPutObject: vi.fn(),
         presignedGetObject: vi.fn(),
         removeObject: vi.fn(),
      },
      resendClient: {
         emails: { send: vi.fn() },
      },
      feedbackSender: {
         send: vi.fn(),
      },
   };
});
