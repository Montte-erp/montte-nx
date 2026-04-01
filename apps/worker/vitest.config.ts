import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
   plugins: [viteTsConfigPaths()],
   test: {
      include: ["./__tests__/**/*.test.ts"],
   },
});
