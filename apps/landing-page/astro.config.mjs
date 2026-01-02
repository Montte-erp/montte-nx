import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
   env: {
      schema: {
         VITE_POSTHOG_HOST: envField.string({
            access: "public",
            context: "client",
         }),
         VITE_POSTHOG_KEY: envField.string({
            access: "public",
            context: "client",
         }),
         VITE_POSTHOG_UI_HOST: envField.string({
            access: "public",
            context: "client",
         }),
      },
   },
   i18n: {
      defaultLocale: "pt",
      locales: ["pt"],
      routing: {
         prefixDefaultLocale: false,
      },
   },
   integrations: [react(), sitemap()],
   output: "static",
   site: "https://www.montte.co",
   vite: {
      plugins: [tailwindcss()],
      ssr: {
         noExternal: ["@packages/localization"],
      },
   },
});
