import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { cac } from "cac";

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   magenta: chalk.magenta,
   red: chalk.red,
   yellow: chalk.yellow,
};

function listAppDirectories() {
   const directories: string[] = [];

   for (const group of ["apps", "packages", "core"]) {
      if (!fs.existsSync(group)) {
         console.log(colors.yellow(`⚠️  No ${group} directory found`));
         continue;
      }

      const entries = fs
         .readdirSync(group, { withFileTypes: true })
         .filter((entry) => entry.isDirectory())
         .map((entry) => path.join(group, entry.name));

      directories.push(...entries);
   }

   return directories;
}

function copyEnvFile(sourcePath: string, targetPath: string, appName: string) {
   if (fs.existsSync(targetPath)) {
      console.log(
         colors.green(
            `✓ ${appName} ${path.basename(targetPath)} file already exists`,
         ),
      );
      return false;
   }

   console.log(
      colors.green(
         `✓ Creating ${path.basename(targetPath)} file for ${appName}`,
      ),
   );
   fs.copyFileSync(sourcePath, targetPath);
   console.log(
      colors.yellow(`⚠️  Please update ${targetPath} with your actual values`),
   );
   return true;
}

function validateEnvFiles(appDirs: string[]) {
   console.log(colors.blue("🔍 Validating environment files..."));

   let allValid = true;
   const missingEnvFiles: string[] = [];
   const missingLocalFiles: string[] = [];
   const missingProductionFiles: string[] = [];
   const missingExamples: string[] = [];

   for (const appDir of appDirs) {
      const appName = path.basename(appDir);
      const envExamplePath = path.join(appDir, ".env.example");

      if (!fs.existsSync(envExamplePath)) {
         missingExamples.push(appName);
         allValid = false;
         continue;
      }

      if (!fs.existsSync(path.join(appDir, ".env"))) {
         missingEnvFiles.push(appName);
         allValid = false;
      }

      if (appDir === path.join("core", "database")) {
         if (!fs.existsSync(path.join(appDir, ".env.local"))) {
            missingLocalFiles.push(appName);
            allValid = false;
         }

         if (!fs.existsSync(path.join(appDir, ".env.production"))) {
            missingProductionFiles.push(appName);
            allValid = false;
         }
      }
   }

   if (allValid) {
      console.log(
         colors.green("✅ All environment files are properly set up!"),
      );
      return true;
   }

   console.log(colors.red("❌ Environment setup issues found:"));

   if (missingExamples.length > 0) {
      console.log(
         colors.yellow(
            `  Missing .env.example files: ${missingExamples.join(", ")}`,
         ),
      );
   }

   if (missingEnvFiles.length > 0) {
      console.log(
         colors.yellow(`  Missing .env files: ${missingEnvFiles.join(", ")}`),
      );
   }

   if (missingLocalFiles.length > 0) {
      console.log(
         colors.yellow(
            `  Missing .env.local files (core/database only): ${missingLocalFiles.join(", ")}`,
         ),
      );
   }

   if (missingProductionFiles.length > 0) {
      console.log(
         colors.yellow(
            `  Missing .env.production files (core/database only): ${missingProductionFiles.join(", ")}`,
         ),
      );
   }

   return false;
}

async function setupEnvironment(options: { env: string; force?: boolean }) {
   console.log(colors.blue("🔧 Setting up environment files for monorepo"));
   console.log(colors.cyan("📁 Scanning for application directories..."));

   const appDirs = listAppDirectories();
   let createdCount = 0;

   for (const appDir of appDirs) {
      const appName = path.basename(appDir);
      const envExamplePath = path.join(appDir, ".env.example");

      if (!fs.existsSync(envExamplePath)) {
         continue;
      }

      const defaultEnvPath = path.join(appDir, ".env");

      if (options.force && fs.existsSync(defaultEnvPath)) {
         fs.copyFileSync(envExamplePath, defaultEnvPath);
         console.log(colors.green(`✓ Overwrote ${defaultEnvPath}`));
         createdCount++;
      } else if (copyEnvFile(envExamplePath, defaultEnvPath, appName)) {
         createdCount++;
      }

      if (appDir !== path.join("core", "database")) {
         continue;
      }

      for (const extraEnvFile of [".env.local", ".env.production"]) {
         const targetPath = path.join(appDir, extraEnvFile);

         if (options.force && fs.existsSync(targetPath)) {
            fs.copyFileSync(envExamplePath, targetPath);
            console.log(colors.green(`✓ Overwrote ${targetPath}`));
            createdCount++;
            continue;
         }

         if (copyEnvFile(envExamplePath, targetPath, appName)) {
            createdCount++;
         }
      }
   }

   console.log(
      colors.green(
         `🎉 Environment setup complete! Created ${createdCount} new environment files`,
      ),
   );
   console.log(colors.yellow("💡 Remember to:"));
   console.log(
      colors.yellow("  1. Update all .env files with your actual values"),
   );
   console.log(colors.yellow("  2. Never commit .env files to git"));
   console.log(
      colors.yellow(
         "  3. Add any required environment variables to .env.example files",
      ),
   );
}

function listEnvironmentStatus() {
   console.log(colors.blue("📋 Environment File Status"));
   console.log(colors.cyan("─".repeat(50)));

   const appDirs = listAppDirectories();

   for (const appDir of appDirs) {
      const appName = path.basename(appDir);
      const envExamplePath = path.join(appDir, ".env.example");
      const hasExample = fs.existsSync(envExamplePath);
      let statusLine = `${colors.magenta(`${appName}:`)} ${hasExample ? "📄" : "❌"} .env.example`;

      if (hasExample) {
         const hasEnv = fs.existsSync(path.join(appDir, ".env"));
         statusLine += ` ${hasEnv ? "📄" : "❌"} .env`;

         if (appDir === path.join("core", "database")) {
            const hasLocal = fs.existsSync(path.join(appDir, ".env.local"));
            const hasProduction = fs.existsSync(
               path.join(appDir, ".env.production"),
            );

            statusLine += ` ${hasLocal ? "📄" : "❌"} .env.local`;
            statusLine += ` ${hasProduction ? "📄" : "❌"} .env.production`;
         }
      }

      console.log(statusLine);
   }
}

function cleanEnvironmentFiles(confirm: boolean) {
   if (!confirm) {
      console.log(
         colors.red("⚠️  This will remove all .env files from the monorepo!"),
      );
      console.log(colors.yellow("Run with --confirm to skip this prompt"));
      return;
   }

   console.log(colors.blue("🧹 Cleaning up .env files..."));

   const appDirs = listAppDirectories();
   let removedCount = 0;

   for (const appDir of appDirs) {
      const envFiles = [".env", ".env.local", ".env.production"];

      for (const envFile of envFiles) {
         const envPath = path.join(appDir, envFile);

         if (!fs.existsSync(envPath)) {
            continue;
         }

         fs.unlinkSync(envPath);
         console.log(colors.green(`✓ Removed ${envPath}`));
         removedCount++;
      }
   }

   console.log(
      colors.green(`🎉 Cleanup complete! Removed ${removedCount} .env files`),
   );
}

const cli = cac("env-setup");

cli.command("setup")
   .option("-f, --force", "Overwrite existing .env files")
   .option("-e, --env <type>", "Environment type to setup", {
      default: "local",
   })
   .action(async (options) => {
      await setupEnvironment({ env: options.env, force: options.force });
   });

cli.command("validate").action(() => {
   const isValid = validateEnvFiles(listAppDirectories());

   if (!isValid) {
      process.exit(1);
   }
});

cli.command("list").action(() => {
   listEnvironmentStatus();
});

cli.command("clean")
   .option("--confirm", "Skip confirmation prompt")
   .action((options) => {
      cleanEnvironmentFiles(Boolean(options.confirm));
   });

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length === 0) {
   cli.outputHelp();
}
