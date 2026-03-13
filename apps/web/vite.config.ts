import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);

const config = defineConfig({
   resolve: {
      alias: {
         "@": fileURLToPath(new URL("./src", import.meta.url)),
         tslib: require.resolve("tslib/tslib.es6.mjs"),
      },
      tsconfigPaths: true,
   },
   optimizeDeps: {
      include: ["react", "react-dom"],
   },
   server: {
      watch: {
         ignored: ["**/node_modules/**", "**/.git/**"],
      },
      hmr: {
         timeout: 60000,
      },
   },

   plugins: [
      devtools(),
      nitro({
         preset: "bun",
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact({
         babel: {
            plugins: ["babel-plugin-react-compiler"],
         },
      }),
   ],
});

export default config;
