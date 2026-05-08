import arcjet, { shield } from "@arcjet/astro";
import node from "@astrojs/node";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
   site: "https://montte.co",
   output: "static",
   adapter: node({ mode: "standalone" }),
   env: {
      schema: {
         PUBLIC_POSTHOG_KEY: envField.string({
            context: "client",
            access: "public",
            optional: true,
         }),
         PUBLIC_POSTHOG_HOST: envField.string({
            context: "client",
            access: "public",
            default: "https://us.i.posthog.com",
         }),
      },
   },
   integrations: [
      react(),
      sitemap(),
      arcjet({ rules: [shield({ mode: "LIVE" })] }),
   ],
   prefetch: { defaultStrategy: "viewport" },
   vite: {
      plugins: [tailwindcss()],
   },
});
