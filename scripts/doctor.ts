import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { cac } from "cac";

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
};

function listEnvDirectories() {
   const directoryGroups = ["apps", "packages", "core"];

   return directoryGroups.flatMap((group) => {
      if (!fs.existsSync(group)) {
         return [];
      }

      return fs
         .readdirSync(group, { withFileTypes: true })
         .filter((entry) => entry.isDirectory())
         .map((entry) => path.join(group, entry.name));
   });
}

const checks = [
   {
      fn: () => {
         const version = process.versions.node;
         const majorVersion = Number.parseInt(version.split(".")[0] || "0", 10);

         if (majorVersion < 20) {
            throw new Error(
               `Node.js version is ${version}, but >=20 is required.`,
            );
         }

         return `v${version}`;
      },
      name: "Node.js Version",
   },
   {
      fn: () => {
         try {
            return execSync("bun --version").toString().trim();
         } catch (error) {
            console.error(error);
            throw new Error(
               "Bun is not installed. Please visit https://bun.sh/",
            );
         }
      },
      name: "Bun Version",
   },
   {
      fn: () => {
         try {
            return execSync("podman --version").toString().trim();
         } catch (error) {
            console.error(error);
            throw new Error(
               "Podman is not installed or not in PATH. Please install it to run local dependencies.",
            );
         }
      },
      name: "Podman",
   },
   {
      fn: () => {
         try {
            return execSync("podman-compose version").toString().trim();
         } catch (error) {
            console.error(error);
            throw new Error(
               "Podman Compose is not available. Please ensure you have podman-compose installed.",
            );
         }
      },
      name: "Podman Compose",
   },
   {
      fn: () => {
         if (!fs.existsSync("node_modules")) {
            throw new Error(
               "node_modules not found. Please run 'bun install'.",
            );
         }

         return "Installed";
      },
      name: "Dependencies",
   },
   {
      fn: () => {
         const missingEnv: string[] = [];
         const missingLocal: string[] = [];
         const missingProduction: string[] = [];

         for (const dir of listEnvDirectories()) {
            const dirName = path.basename(dir);
            const hasExample = fs.existsSync(path.join(dir, ".env.example"));

            if (!hasExample) {
               continue;
            }

            if (!fs.existsSync(path.join(dir, ".env"))) {
               missingEnv.push(dirName);
            }

            if (dir === path.join("core", "database")) {
               if (!fs.existsSync(path.join(dir, ".env.local"))) {
                  missingLocal.push(dirName);
               }

               if (!fs.existsSync(path.join(dir, ".env.production"))) {
                  missingProduction.push(dirName);
               }
            }
         }

         const issues: string[] = [];

         if (missingEnv.length > 0) {
            issues.push(`Missing .env files in: ${missingEnv.join(", ")}`);
         }

         if (missingLocal.length > 0) {
            issues.push(
               `Missing .env.local files (core/database only): ${missingLocal.join(", ")}`,
            );
         }

         if (missingProduction.length > 0) {
            issues.push(
               `Missing .env.production files (core/database only): ${missingProduction.join(", ")}`,
            );
         }

         if (issues.length > 0) {
            throw new Error(
               `${issues.join(". ")}. Run 'bun run scripts/env-setup.ts setup' to create missing environment files.`,
            );
         }

         return "All environment files found";
      },
      name: "Environment Files",
   },
   {
      fn: () => {
         if (!fs.existsSync("tsconfig.json")) {
            throw new Error("Root tsconfig.json not found");
         }

         return "Found";
      },
      name: "TypeScript Configuration",
   },
   {
      fn: () => {
         if (!fs.existsSync("nx.json")) {
            throw new Error("nx.json not found");
         }

         return "Found";
      },
      name: "Nx Configuration",
   },
];

async function runDoctor() {
   console.log(colors.blue.bold("🩺 Running Contentta Environment Doctor..."));
   console.log("-".repeat(40));

   let allGood = true;

   for (const check of checks) {
      process.stdout.write(`- ${colors.cyan(check.name)}: `);

      try {
         const result = await Promise.resolve(check.fn());
         console.log(colors.green(`✓ OK (${result})`));
      } catch (error) {
         const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
         console.log(colors.red("✗ FAILED"));
         console.log(`  ${colors.red(errorMessage)}`);
         allGood = false;
      }
   }

   console.log("-".repeat(40));

   if (allGood) {
      console.log(colors.green.bold("✅ Your environment looks good!"));
      return;
   }

   console.log(
      colors.red.bold(
         "❌ Some checks failed. Please resolve the issues above.",
      ),
   );
   process.exit(1);
}

const cli = cac("doctor");

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length > 0) {
   cli.outputHelp();
   process.exit(1);
}

runDoctor().catch((error) => {
   console.error(colors.red("Doctor failed:"), error);
   process.exit(1);
});
