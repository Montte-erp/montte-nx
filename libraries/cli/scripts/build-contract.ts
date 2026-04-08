import { build } from "esbuild";
import { glob } from "node:fs/promises";

const contractFiles = await Array.fromAsync(
   glob("src/contract/**/*.ts", { cwd: process.cwd() }),
);

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
