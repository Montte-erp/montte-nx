import arcjet, { validateEmail } from "@arcjet/astro";
import mdx from "@astrojs/mdx";
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
         }),
         PUBLIC_POSTHOG_HOST: envField.string({
            context: "client",
            access: "public",
         }),
      },
   },
   integrations: [
      react(),
      sitemap(),
      mdx(),
      arcjet({
         rules: [
            validateEmail({
               mode: "LIVE",
               deny: ["INVALID", "DISPOSABLE"],
            }),
         ],
      }),
   ],
   prefetch: { defaultStrategy: "viewport" },
   vite: {
      resolve: {
         tsconfigPaths: true,
      },
      plugins: [tailwindcss()],
   },
});
