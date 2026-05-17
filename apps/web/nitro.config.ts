import { defineConfig } from "nitro";
import evlog from "evlog/nitro/v3";

export default defineConfig({
   preset: "bun",
   experimental: {
      asyncContext: true,
   },
   modules: [
      evlog({
         env: {
            service: "montte-web",
         },
         redact: {
            paths: [
               "headers.authorization",
               "headers.cookie",
               "headers.set-cookie",
               "orpc.input.password",
               "orpc.input.token",
               "orpc.input.secret",
               "orpc.input.apiKey",
            ],
         },
      }),
   ],
   plugins: ["./src/integrations/evlog"],
   rollupConfig: {
      external: (id: string) =>
         id.startsWith("@dbos-inc/") ||
         id === "katex" ||
         id.startsWith("katex/") ||
         id === "mermaid" ||
         id.startsWith("mermaid/") ||
         id === "streamdown" ||
         id.startsWith("streamdown/"),
   },
});
