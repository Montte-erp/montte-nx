import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
   plugins: [
      viteTsConfigPaths({
         projects: [
            "./tsconfig.test.json",
            "./core/authentication/tsconfig.json",
            "./core/database/tsconfig.json",
            "./core/files/tsconfig.json",
            "./core/logging/tsconfig.json",
         ],
      }),
   ],
   test: {
      include: ["./__tests__/**/*.test.ts"],
   },
});
