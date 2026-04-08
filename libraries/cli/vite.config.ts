import { defineConfig, mergeConfig } from "vite";
import { tanstackViteConfig } from "@tanstack/vite-config";

export default mergeConfig(
   defineConfig({
      build: {
         rollupOptions: {
            treeshake: false,
         },
      },
   }),
   tanstackViteConfig({
      entry: "./src/index.ts",
      srcDir: "./src",
   }),
);
