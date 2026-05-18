import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "nitro";
import evlog from "evlog/nitro/v3";

const dbosSdkPackage = ["@dbos-inc", "dbos-sdk"].join("/");
const currentDir = dirname(fileURLToPath(import.meta.url));
const montteEvlogPlugin = {
   name: "montte-evlog-plugin",
   setup(nitro) {
      nitro.options.plugins = nitro.options.plugins ?? [];
      nitro.options.plugins.push(resolve(currentDir, "src/integrations/evlog"));
   },
};

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
      montteEvlogPlugin,
   ],
   rollupConfig: {
      external: (id: string) =>
         id === dbosSdkPackage ||
         id.startsWith(`${dbosSdkPackage}/`) ||
         id === "katex" ||
         id.startsWith("katex/") ||
         id === "mermaid" ||
         id.startsWith("mermaid/") ||
         id === "streamdown" ||
         id.startsWith("streamdown/"),
   },
});
