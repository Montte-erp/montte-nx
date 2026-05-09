import node from "@astrojs/node";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
   site: "https://montte.co",
   output: "static",
   adapter: node({ mode: "standalone" }),
   integrations: [react(), sitemap()],
   prefetch: { defaultStrategy: "viewport" },
   vite: {
      plugins: [tailwindcss()],
   },
});
