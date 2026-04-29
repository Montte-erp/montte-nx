import { chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const externals = [
   "drizzle-orm",
   "@orpc/server",
   "@orpc/client",
   "@orpc/contract",
   "neverthrow",
   "zod",
   "commander",
   "jiti",
];

await Promise.all([
   build({
      entryPoints: ["src/database/drizzle.ts"],
      outdir: "dist/esm/database",
      format: "esm",
      sourcemap: true,
      bundle: true,
      external: externals,
   }),
   build({
      entryPoints: ["src/database/drizzle.ts"],
      outdir: "dist/cjs/database",
      format: "cjs",
      outExtension: { ".js": ".cjs" },
      sourcemap: true,
      bundle: true,
      external: externals,
   }),
   build({
      entryPoints: ["src/cli/index.ts"],
      outdir: "dist/esm/cli",
      format: "esm",
      platform: "node",
      target: "node20",
      sourcemap: true,
      bundle: true,
      external: externals,
      banner: { js: "#!/usr/bin/env node" },
   }),
]);

await chmod(resolve("dist/esm/cli/index.js"), 0o755);

console.log("Subpaths built.");
