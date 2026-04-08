import { build } from "esbuild";
import { glob } from "node:fs/promises";

const betterAuthFiles = await Array.fromAsync(
   glob("src/better-auth/**/*.ts", { cwd: process.cwd() }),
);

const contractFiles = await Array.fromAsync(
   glob("src/contract.ts", { cwd: process.cwd() }),
);

const builds: Parameters<typeof build>[0][] = [];

const betterAuthExternals = [
   "better-auth",
   "better-auth/client",
   "neverthrow",
   "@orpc/client",
   "@orpc/client/fetch",
   "@orpc/contract",
   "zod",
];

if (betterAuthFiles.length > 0) {
   builds.push(
      {
         entryPoints: betterAuthFiles,
         outdir: "dist/esm/better-auth",
         format: "esm",
         sourcemap: true,
         bundle: true,
         external: betterAuthExternals,
      },
      {
         entryPoints: betterAuthFiles,
         outdir: "dist/cjs/better-auth",
         format: "cjs",
         outExtension: { ".js": ".cjs" },
         sourcemap: true,
         bundle: true,
         external: betterAuthExternals,
      },
   );
}

if (contractFiles.length > 0) {
   builds.push(
      {
         entryPoints: contractFiles,
         outdir: "dist/esm",
         format: "esm",
         sourcemap: true,
         bundle: false,
      },
      {
         entryPoints: contractFiles,
         outdir: "dist/cjs",
         format: "cjs",
         outExtension: { ".js": ".cjs" },
         sourcemap: true,
         bundle: false,
      },
   );
}

await Promise.all(builds.map((b) => build(b)));
console.log("Subpaths built.");
