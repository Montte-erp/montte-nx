import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
   plugins: [
      viteTsConfigPaths({
         projects: ["./tsconfig.test.json", "../logging/tsconfig.json"],
      }),
   ],
   test: {
      include: ["./__tests__/**/*.test.ts"],
   },
});
