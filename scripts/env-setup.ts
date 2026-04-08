import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { cac } from "cac";

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
};

const ENV_EXAMPLE = path.join("apps", "web", ".env.example");
const ENV_LOCAL = path.join("apps", "web", ".env.local");

function setupEnvironment(options: { force?: boolean }) {
   console.log(colors.blue("🔧 Setting up environment for Montte"));

   if (!fs.existsSync(ENV_EXAMPLE)) {
      console.log(colors.red(`❌ ${ENV_EXAMPLE} not found.`));
      process.exit(1);
   }

   if (fs.existsSync(ENV_LOCAL) && !options.force) {
      console.log(colors.green(`✓ ${ENV_LOCAL} already exists — skipping.`));
      console.log(colors.yellow("  Use --force to overwrite."));
      return;
   }

   fs.copyFileSync(ENV_EXAMPLE, ENV_LOCAL);
   console.log(colors.green(`✓ Created ${ENV_LOCAL}`));
   console.log(
      colors.yellow(
         `⚠️  Fill in your values in ${ENV_LOCAL} before running the app.`,
      ),
   );
}

function validateEnvironment() {
   console.log(colors.blue("🔍 Validating environment file..."));

   if (!fs.existsSync(ENV_LOCAL)) {
      console.log(colors.red(`❌ ${ENV_LOCAL} not found.`));
      console.log(
         colors.yellow(
            `  Copy ${ENV_EXAMPLE} to ${ENV_LOCAL} and fill in your values.`,
         ),
      );
      process.exit(1);
   }

   const content = fs.readFileSync(ENV_LOCAL, "utf8").trim();

   if (content.length === 0) {
      console.log(colors.red(`❌ ${ENV_LOCAL} is empty.`));
      process.exit(1);
   }

   console.log(colors.green(`✅ ${ENV_LOCAL} exists and is non-empty.`));
}

function listEnvironmentStatus() {
   console.log(colors.blue("📋 Environment File Status"));
   console.log(colors.cyan("─".repeat(50)));

   const exists = fs.existsSync(ENV_LOCAL);

   if (!exists) {
      console.log(colors.red(`❌ ${ENV_LOCAL} — missing`));
      return;
   }

   const content = fs.readFileSync(ENV_LOCAL, "utf8");
   const keyCount = content
      .split("\n")
      .filter(
         (line) =>
            line.trim() && !line.trim().startsWith("#") && line.includes("="),
      ).length;

   console.log(colors.green(`✓ ${ENV_LOCAL} — exists (${keyCount} keys)`));
}

const cli = cac("env-setup");

cli.command("setup")
   .option("-f, --force", "Overwrite existing .env.local")
   .action((options) => {
      setupEnvironment({ force: options.force });
   });

cli.command("validate").action(() => {
   validateEnvironment();
});

cli.command("list").action(() => {
   listEnvironmentStatus();
});

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length === 0) {
   cli.outputHelp();
}
