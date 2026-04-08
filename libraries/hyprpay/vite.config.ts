import { defineConfig, mergeConfig } from "vite";
import { tanstackViteConfig } from "@tanstack/vite-config";

const config = defineConfig({});

export default mergeConfig(
   config,
   tanstackViteConfig({
      entry: ["./src/index.ts", "./src/better-auth/index.ts"],
      srcDir: "./src",
   }),
);
