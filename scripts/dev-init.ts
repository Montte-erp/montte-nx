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

// ── 2. Install dependencies if needed ────────────────────────────────────────
if (!fs.existsSync("node_modules")) {
   step("node_modules not found — installing dependencies...");
   run("bun install");
   ok("Dependencies installed.");
}

// ── 3. Start containers ───────────────────────────────────────────────────────
step("Starting containers...");
try {
   run("bun run --cwd apps/web container-start");
} catch {
   console.log(colors.yellow("⚠ Could not start containers — continuing."));
}

// ── 4. Push DB schema ─────────────────────────────────────────────────────────
step("Pushing database schema...");
try {
   run("bun run db:push");
} catch {
   console.log(
      colors.yellow("⚠ db:push failed — DB may already be up to date."),
   );
}

ok("Dev init complete.");
