import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
   viteConfig,
   defineConfig({
      plugins: [],
      test: {
         include: ["./__tests__/**/*.test.{ts,tsx}"],
         hookTimeout: 30000,
         setupFiles: ["./__tests__/helpers/mock-singletons.ts"],
         env: {
            DATABASE_URL: "postgresql://test:test@localhost:5432/test",
            REDIS_URL: "redis://localhost:6379",
            BETTER_AUTH_SECRET: "test-secret-key-min-32-characters-long-xxx",
            BETTER_AUTH_URL: "http://localhost:3000",
            BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
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
         coverage: {
            provider: "istanbul",
            reporter: ["lcov", "text"],
            reportsDirectory: "./coverage",
            include: [
               "src/integrations/orpc/**",
               "src/lib/**",
               "../../core/database/src/**",
               "../../core/logging/src/**",
               "../../core/authentication/src/**",
               "../../core/files/src/**",
            ],
            exclude: [
               "**/*.test.{ts,tsx}",
               "**/__tests__/**",
               "**/dist/**",
               "**/node_modules/**",
            ],
         },
      },
   }),
);
