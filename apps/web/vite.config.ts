import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
   resolve: {
      tsconfigPaths: true,
   },
   optimizeDeps: {
      include: ["react", "react-dom"],
   },
   server: {
      watch: {
         ignored: ["**/node_modules/**", "**/.git/**"],
      },
   },

   plugins: [tanstackStart(), viteReact(), tailwindcss(), devtools()],
});

export default config;
