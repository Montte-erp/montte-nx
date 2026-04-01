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
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/routes/**", "src/integrations/**"],
            reporter: ["text", "lcov"],
         },
      },
   }),
);
