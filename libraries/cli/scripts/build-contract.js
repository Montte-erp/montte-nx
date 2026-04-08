import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { join } from "node:path";
function collectTs(dir) {
   return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collectTs(full);
      if (entry.name.endsWith(".ts")) return [full];
      return [];
   });
}
const contractFiles = collectTs("src/contract");
await Promise.all([
   build({
      entryPoints: contractFiles,
      outdir: "dist/esm/contract",
      format: "esm",
      sourcemap: true,
      bundle: false,
   }),
   build({
      entryPoints: contractFiles,
      outdir: "dist/cjs/contract",
      format: "cjs",
      outExtension: { ".js": ".cjs" },
      sourcemap: true,
      bundle: false,
   }),
]);
console.log("Contract built.");
