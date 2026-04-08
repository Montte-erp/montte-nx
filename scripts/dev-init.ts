import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
};

const envExamplePath = path.join("apps", "web", ".env.example");
const envLocalPath = path.join("apps", "web", ".env.local");

function step(msg: string) {
   console.log(colors.blue(`▶ ${msg}`));
}

function ok(msg: string) {
   console.log(colors.green(`✓ ${msg}`));
}

function run(cmd: string) {
   execSync(cmd, { stdio: "inherit" });
}

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
            return "";
         }
      }
   }
}

// ── 1. Ensure .env.local exists ──────────────────────────────────────────────
if (!fs.existsSync(envLocalPath)) {
   if (!fs.existsSync(envExamplePath)) {
      console.error(colors.red("❌ apps/web/.env.example not found."));
      process.exit(1);
   }
   fs.copyFileSync(envExamplePath, envLocalPath);
   ok("Created apps/web/.env.local from .env.example");
   console.log(
      colors.yellow(
         "  ⚠ Placeholder values are in use. Replace them with real keys for full functionality.",
      ),
   );
}

// ── 2. Start containers ───────────────────────────────────────────────────────
const compose = detectComposeCommand();
const composeFile = path.join("apps", "web", "docker-compose.yml");

if (!compose) {
   console.log(
      colors.yellow(
         "⚠ No container runtime found (Docker/Podman). Skipping container start.",
      ),
   );
} else {
   step("Starting containers...");
   try {
      run(`${compose} -f ${composeFile} up -d`);
   } catch {
      console.log(colors.yellow("⚠ Could not start containers — continuing."));
   }
}

// ── 3. Push DB schema ─────────────────────────────────────────────────────────
step("Pushing database schema...");
try {
   run("bun run db:push");
} catch {
   console.log(
      colors.yellow("⚠ db:push failed — DB may already be up to date."),
   );
}

// ── 4. Seed event catalog ─────────────────────────────────────────────────────
step("Seeding event catalog...");
try {
   run("bun run scripts/seed-event-catalog.ts run --env local");
} catch {
   console.log(colors.yellow("⚠ Event catalog seeding failed — continuing."));
}

ok("Dev init complete.");
