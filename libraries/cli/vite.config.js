import { defineConfig, mergeConfig } from "vite";
import { tanstackViteConfig } from "@tanstack/vite-config";
export default mergeConfig(
   tanstackViteConfig({
      entry: "./src/index.ts",
      srcDir: "./src",
   }),
   defineConfig({
      build: {
         rollupOptions: {
            treeshake: false,
         },
      },
   }),
);
