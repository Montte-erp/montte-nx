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
         coverage: {
            provider: "istanbul",
            reporter: ["lcov", "text"],
            reportsDirectory: "./coverage",
            include: [
               "src/**",
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
