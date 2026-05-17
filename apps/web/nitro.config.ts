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
      }),
   ],
   plugins: ["./src/integrations/evlog"],
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
});
