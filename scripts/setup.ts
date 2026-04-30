import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";

const colors = {
   blue: chalk.blue,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
};

const envExamplePath = path.join("apps", "web", ".env.example");
const envLocalPath = path.join("apps", "web", ".env.local");

function detectComposeCommand(): string {
   try {
      execSync("docker compose version", { stdio: "pipe" });
      return "docker compose";
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
               "No container runtime found. Install Docker or Podman.",
            );
         }
      }
   }
}

function startContainers(): void {
   console.log(colors.blue("▶ Starting containers..."));
   const compose = detectComposeCommand();
   const composeFile = path.join("apps", "web", "docker-compose.yml");
   execSync(`${compose} -f ${composeFile} up -d`, { stdio: "inherit" });
}

console.log(colors.blue.bold("🚀 Montte — First-time Setup"));
console.log("-".repeat(40));

if (!fs.existsSync(envExamplePath)) {
   console.error(
      colors.red(
         `❌ ${envExamplePath} not found. Is this the correct directory?`,
      ),
   );
   process.exit(1);
}

if (!fs.existsSync(envLocalPath)) {
   fs.copyFileSync(envExamplePath, envLocalPath);
   console.log(colors.green(`✅ Created ${envLocalPath}`));
   console.log("");
   console.log(colors.yellow("  Fill in your values in apps/web/.env.local:"));
   console.log(colors.yellow("    - DATABASE_URL"));
   console.log(colors.yellow("    - REDIS_URL"));
   console.log(colors.yellow("    - MINIO_* credentials"));
   console.log(colors.yellow("    - Any other required secrets"));
   console.log("");
   console.log(
      colors.green.bold(
         "✅ Created apps/web/.env.local — fill in your values, then run 'bun setup' again.",
      ),
   );
   process.exit(0);
}

try {
   startContainers();
} catch (err) {
   const message = err instanceof Error ? err.message : String(err);
   console.error(colors.red(`❌ Failed to start containers: ${message}`));
   process.exit(1);
}

try {
   console.log(colors.blue("▶ Pushing database schema..."));
   execSync("bun run db:push", { stdio: "inherit" });
} catch {
   console.error(colors.red("❌ db:push failed."));
   process.exit(1);
}

console.log("");
console.log(colors.green.bold("✅ Setup complete! Run 'bun dev' to start."));
