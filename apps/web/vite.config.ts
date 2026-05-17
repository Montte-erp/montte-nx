import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import evlog from "evlog/nitro/v3";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const evlogAuthPlugin = fileURLToPath(
   new URL("./src/integrations/evlog/evlog-auth.ts", import.meta.url),
);
const evlogDrainPlugin = fileURLToPath(
   new URL("./src/integrations/evlog/evlog-drain.ts", import.meta.url),
);

const config = defineConfig({
   resolve: {
      tsconfigPaths: true,
   },
   optimizeDeps: {
      include: ["react", "react-dom"],
   },
   oxc: {
      transform: {
         target: "es2022",
      },
      decorators: {
         legacy: true,
      },
   },
   server: {
      watch: {
         ignored: ["**/node_modules/**", "**/.git/**"],
      },
   },

   plugins: [
      tanstackStart({
         router: {
            autoCodeSplitting: true,
         },
      }),
      nitro({
         preset: "bun",
         experimental: {
            asyncContext: true,
         },
         modules: [
            evlog({
               env: {
                  service: "montte-web",
               },
            }),
            {
               name: "montte-evlog",
               setup(nitroApp) {
                  nitroApp.options.plugins.push(
                     evlogDrainPlugin,
                     evlogAuthPlugin,
                  );
               },
            },
         ],
         rollupConfig: {
            external: (id: string) =>
               id === "@dbos-inc/dbos-sdk" ||
               id.startsWith("@dbos-inc/dbos-sdk/") ||
               id === "katex" ||
               id.startsWith("katex/") ||
               id === "mermaid" ||
               id.startsWith("mermaid/") ||
               id === "streamdown" ||
               id.startsWith("streamdown/"),
         },
      }),
      viteReact(),
      tailwindcss(),
      devtools(),
   ],
});

export default config;
