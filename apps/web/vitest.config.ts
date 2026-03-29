import { fileURLToPath, URL } from "node:url";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
   esbuild: {
      jsx: "automatic",
   },
   plugins: [
      viteTsConfigPaths({
         projects: [
            "./tsconfig.json",
            "../../core/authentication/tsconfig.json",
            "../../core/database/tsconfig.json",
            "../../core/files/tsconfig.json",
            "../../core/logging/tsconfig.json",
         ],
      }),
   ],
   resolve: {
      alias: {
         "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
   },
   test: {
      include: ["./__tests__/**/*.test.{ts,tsx}"],
      hookTimeout: 30000,
      setupFiles: ["./__tests__/helpers/mock-singletons.ts"],
   },
});
