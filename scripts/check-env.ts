import * as fs from "node:fs";
import * as path from "node:path";

const args = process.argv.slice(2);
const envFlagIndex = args.indexOf("--env");
const env = envFlagIndex !== -1 ? args[envFlagIndex + 1] : "local";

const candidates =
   env === "local"
      ? [".env.local", ".env"]
      : [`.env.${env}.local`, `.env.${env}`, ".env.local", ".env"];

const found = candidates.some((f) =>
   fs.existsSync(path.join("apps", "web", f)),
);

if (!found) {
   const primary = env === "local" ? ".env.local" : `.env.${env}.local`;
   console.error(`❌ apps/web/${primary} not found.`);
   if (env === "local") {
      console.error("   Run 'bun setup' to get started.");
   } else {
      console.error(
         `   Copy apps/web/.env.${env}.example to apps/web/.env.${env}.local and fill in your values.`,
      );
   }
   process.exit(1);
}
