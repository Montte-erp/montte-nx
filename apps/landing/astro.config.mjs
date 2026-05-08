import arcjet, { detectBot, shield, validateEmail } from "@arcjet/astro";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
   site: "https://montte.com.br",
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
      arcjet({
         rules: [
            shield({ mode: "LIVE" }),
            detectBot({
               mode: "LIVE",
               allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
            }),
            validateEmail({
               mode: "LIVE",
               deny: ["INVALID", "DISPOSABLE", "NO_MX_RECORDS"],
            }),
         ],
      }),
   ],
   prefetch: { defaultStrategy: "viewport" },
   vite: {
      plugins: [tailwindcss()],
   },
});
