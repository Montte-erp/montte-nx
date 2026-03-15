import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const require = createRequire(import.meta.url);

const config = defineConfig({
   resolve: {
      alias: {
         "@": fileURLToPath(new URL("./src", import.meta.url)),
         tslib: require.resolve("tslib/tslib.es6.mjs"),
      },
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
      tsconfigPaths(),
      tanstackStart(),
      viteReact(),
      tailwindcss(),
      devtools(),
   ],
});

export default config;
