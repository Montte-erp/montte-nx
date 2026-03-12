import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as readline from "node:readline";
import chalk from "chalk";
import { cac } from "cac";

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
};

const CLEAN_TARGETS = [
   ".nx/cache",
   ".nx/workspace-data",
   ".turbo",
   "dist",
   "build",
   "apps/*/dist",
   "apps/*/build",
   "apps/*/.tanstack",
   "apps/*/.astro",
   "apps/*/.cache",
   "libraries/*/dist",
   "packages/*/dist",
   "packages/*/.mastra",
   "packages/*/.cache",
   "packages/*/build",
   "node_modules",
   "bun.lockb",
   "package-lock.json",
   "yarn.lock",
   "pnpm-lock.yaml",
   ".DS_Store",
   "*.tsbuildinfo",
   ".eslintcache",
   ".cache",
   "**/drizzle",
   "**/.drizzle",
];

const DEEP_CLEAN_TARGETS = [
   "apps/*/node_modules",
   "packages/*/node_modules",
   "libraries/*/node_modules",
   "core/*/node_modules",
];

const CACHE_TARGETS = [
   ".nx/cache",
   ".nx/workspace-data",
   ".turbo",
   ".cache",
   ".eslintcache",
   "*.tsbuildinfo",
];

function runCommand(
   command: string,
   cwd: string = process.cwd(),
): Promise<void> {
   return new Promise((resolve, reject) => {
      console.log(colors.blue(`🚀 Running: ${command}`));

      const child = spawn(command, [], {
         cwd,
         shell: true,
         stdio: "inherit",
      });

      child.on("close", (code) => {
         if (code === 0) {
            resolve();
            return;
         }

         reject(new Error(`Command failed with exit code ${code}`));
      });

      child.on("error", reject);
   });
}

function deletePath(pathToDelete: string) {
   try {
      if (!fs.existsSync(pathToDelete)) {
         return false;
      }

      const stats = fs.statSync(pathToDelete);

      if (stats.isDirectory()) {
         fs.rmSync(pathToDelete, { force: true, recursive: true });
         console.log(colors.green(`🗑️  Deleted directory: ${pathToDelete}`));
         return true;
      }

      fs.unlinkSync(pathToDelete);
      console.log(colors.green(`🗑️  Deleted file: ${pathToDelete}`));
      return true;
   } catch (error) {
      console.log(colors.red(`❌ Failed to delete ${pathToDelete}: ${error}`));
      return false;
   }
}

function expandGlobPatterns(patterns: string[]) {
   const expandedPaths = new Set<string>();

   for (const pattern of patterns) {
      try {
         const result = execSync(
            `find . -path "${pattern}" -not -path "./node_modules/*" 2>/dev/null || true`,
            {
               cwd: process.cwd(),
               encoding: "utf8",
            },
         );

         for (const entry of result.trim().split("\n").filter(Boolean)) {
            expandedPaths.add(entry);
         }
      } catch (error) {
         console.error(
            colors.red(`❌ Error expanding pattern ${pattern}: ${error}`),
         );
      }
   }

   return [...expandedPaths].sort();
}

function askQuestion(question: string) {
   const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
   });

   return new Promise<string>((resolve) => {
      rl.question(question, (answer) => {
         rl.close();
         resolve(answer);
      });
   });
}

async function clean(options: {
   dryRun?: boolean;
   noInstall?: boolean;
   deep?: boolean;
}) {
   console.log(colors.blue.bold("🧹 Starting monorepo cleanup..."));
   console.log(colors.cyan("─".repeat(50)));

   if (options.dryRun) {
      console.log(colors.yellow("🔍 DRY RUN MODE - No files will be deleted"));
      console.log(colors.cyan("─".repeat(50)));
   }

   const targets = options.deep
      ? [...CLEAN_TARGETS, ...DEEP_CLEAN_TARGETS]
      : CLEAN_TARGETS;
   const pathsToClean = expandGlobPatterns(targets);

   if (pathsToClean.length === 0) {
      console.log(colors.green("✅ No cache or build files found to clean"));
      return;
   }

   let deletedCount = 0;
   let skippedCount = 0;

   console.log(colors.blue(`📋 Found ${pathsToClean.length} items to clean:`));

   for (const pathToClean of pathsToClean) {
      if (options.dryRun) {
         console.log(colors.yellow(`🔍 Would delete: ${pathToClean}`));
         deletedCount++;
         continue;
      }

      if (deletePath(pathToClean)) {
         deletedCount++;
      } else {
         skippedCount++;
      }
   }

   console.log(colors.cyan("─".repeat(50)));

   if (options.dryRun) {
      console.log(
         colors.yellow(`🔍 DRY RUN: Would delete ${deletedCount} items`),
      );
      console.log(
         colors.blue("💡 Run without --dry-run to actually delete these files"),
      );
      return;
   }

   console.log(
      colors.green(`🎉 Cleanup complete! Deleted ${deletedCount} items`),
   );

   if (skippedCount > 0) {
      console.log(colors.yellow(`⚠️  Skipped ${skippedCount} items`));
   }

   const rootNodeModulesDeleted = pathsToClean.includes("node_modules");

   if (!rootNodeModulesDeleted || options.noInstall) {
      return;
   }

   console.log(colors.blue("📦 Root node_modules was deleted"));
   const answer = await askQuestion(
      colors.yellow("🤔 Would you like to reinstall dependencies? (y/N): "),
   );

   if (!["y", "yes"].includes(answer.toLowerCase())) {
      return;
   }

   console.log(colors.blue("📦 Reinstalling dependencies..."));

   try {
      await runCommand("bun install");
      console.log(colors.green("✅ Dependencies reinstalled successfully"));
   } catch (error) {
      console.error(colors.red("❌ Failed to reinstall dependencies"), error);
   }
}

async function cleanCache(options: { dryRun?: boolean }) {
   console.log(colors.blue.bold("🧹 Starting cache cleanup..."));
   console.log(colors.cyan("─".repeat(50)));

   const pathsToClean = expandGlobPatterns(CACHE_TARGETS);

   if (pathsToClean.length === 0) {
      console.log(colors.green("✅ No cache files found to clean"));
      return;
   }

   let deletedCount = 0;

   for (const pathToClean of pathsToClean) {
      if (options.dryRun) {
         console.log(colors.yellow(`🔍 Would delete: ${pathToClean}`));
         deletedCount++;
         continue;
      }

      if (deletePath(pathToClean)) {
         deletedCount++;
      }
   }

   if (options.dryRun) {
      console.log(
         colors.yellow(`🔍 DRY RUN: Would delete ${deletedCount} items`),
      );
      return;
   }

   console.log(
      colors.green(`🎉 Cache cleanup complete! Deleted ${deletedCount} items`),
   );
}

async function reset(options: {
   force?: boolean;
   noInstall?: boolean;
   deep?: boolean;
}) {
   console.log(colors.blue.bold("🔄 Starting monorepo reset..."));
   console.log(
      colors.yellow(
         "⚠️  This will delete ALL uncommitted changes and reset the repository",
      ),
   );
   console.log(colors.cyan("─".repeat(50)));

   if (!options.force) {
      const answer = await askQuestion(
         colors.red(
            "🚨 Are you absolutely sure you want to continue? This action cannot be undone. (type 'RESET' to confirm): ",
         ),
      );

      if (answer !== "RESET") {
         console.log(colors.green("✅ Reset cancelled"));
         return;
      }
   }

   try {
      console.log(colors.blue("🔄 Resetting git repository..."));
      await runCommand("git reset --hard HEAD");
      await runCommand("git clean -fd");
      await clean({ ...options, noInstall: true });
      console.log(colors.green("🎉 Monorepo reset complete!"));
   } catch (error) {
      console.log(colors.red(`❌ Reset failed: ${error}`));
   }
}

const cli = cac("clean");

cli.command("clean")
   .option("--dry-run", "Show what would be deleted without actually deleting")
   .option("--no-install", "Skip dependency reinstallation prompt")
   .option("--deep", "Also clean node_modules in nested workspaces")
   .action(async (options) => {
      await clean(options);
   });

cli.command("reset")
   .option("--force", "Skip confirmation prompt")
   .option("--no-install", "Skip dependency reinstallation prompt")
   .option("--deep", "Also clean node_modules in nested workspaces")
   .action(async (options) => {
      await reset(options);
   });

cli.command("cache")
   .option("--dry-run", "Show what would be deleted without actually deleting")
   .action(async (options) => {
      await cleanCache(options);
   });

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length === 0) {
   cli.outputHelp();
}
