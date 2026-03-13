import { vi } from "vitest";

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
