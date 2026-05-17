import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: {
      tsconfigPaths: true,
   },
   test: {
      include: ["./__tests__/**/*.test.ts"],
   },
});
