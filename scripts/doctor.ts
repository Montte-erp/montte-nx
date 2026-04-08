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
            const version = execSync("docker --version").toString().trim();
            return `docker (${version})`;
         } catch {
            try {
               const version = execSync("podman --version").toString().trim();
               return `podman (${version})`;
            } catch {
               throw new Error(
                  "Neither docker nor podman found in PATH. Please install one to run local dependencies.",
               );
            }
         }
      },
      name: "Container Runtime",
   },
   {
      fn: () => {
         try {
            execSync("docker compose version", { stdio: "pipe" });
            return "docker compose (plugin)";
         } catch {
            try {
               execSync("docker-compose --version", { stdio: "pipe" });
               return "docker-compose";
            } catch {
               try {
                  execSync("podman-compose version", { stdio: "pipe" });
                  return "podman-compose";
               } catch {
                  throw new Error(
                     "No compose tool found. Install docker compose plugin, docker-compose, or podman-compose.",
                  );
               }
            }
         }
      },
      name: "Compose Tool",
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
         const envLocalPath = path.join("apps", "web", ".env.local");

         if (!fs.existsSync(envLocalPath)) {
            throw new Error(
               "apps/web/.env.local not found. Copy apps/web/.env.example and fill in your values.",
            );
         }

         return "apps/web/.env.local found";
      },
      name: "Environment File",
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
   console.log(colors.blue.bold("🩺 Running Montte Environment Doctor..."));
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
