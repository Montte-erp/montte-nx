import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

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
         rollupConfig: {
            external: (id: string) =>
               id === "@dbos-inc/dbos-sdk" ||
               id.startsWith("@dbos-inc/dbos-sdk/"),
         },
      }),
      viteReact(),
      tailwindcss(),
      devtools(),
   ],
});

export default config;
