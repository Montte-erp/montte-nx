import { spawn } from "node:child_process";
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

const DATABASE_PACKAGES = ["database"];

function getPackageDirectory(packageName: string) {
   return path.join("core", packageName);
}

function getEnvFilePath(_packageDir: string, env: string) {
   const webDir = path.join(process.cwd(), "apps", "web");
   const possibleFiles = [
      `.env.${env}.local`,
      `.env.${env}`,
      ".env.local",
      ".env",
   ];

   for (const file of possibleFiles) {
      const filePath = path.join(webDir, file);

      if (fs.existsSync(filePath)) {
         return filePath;
      }
   }

   throw new Error(`No environment file found for ${env} in apps/web`);
}

function runCommand(
   command: string,
   cwd: string,
   envFile: string,
): Promise<void> {
   return new Promise((resolve, reject) => {
      console.log(colors.blue(`🚀 Running: ${command} in ${cwd}`));
      console.log(colors.cyan(`📁 Using env file: ${envFile}`));

      const child = spawn(`dotenv -e ${envFile} ${command}`, [], {
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

function parsePackages(packages?: string) {
   return packages
      ? packages.split(",").map((packageName) => packageName.trim())
      : DATABASE_PACKAGES;
}

async function runOnPackages(action: string, env: string, packages: string[]) {
   console.log(colors.blue(`🔧 Running ${action} with ${env} environment`));
   console.log(colors.cyan("─".repeat(50)));

   const results: { package: string; success: boolean; error?: string }[] = [];

   for (const packageName of packages) {
      const packageDir = getPackageDirectory(packageName);

      if (!fs.existsSync(packageDir)) {
         console.log(
            colors.red(`❌ Package directory not found: ${packageDir}`),
         );
         results.push({
            package: packageName,
            success: false,
            error: "Directory not found",
         });
         continue;
      }

      try {
         const envFile = getEnvFilePath(packageDir, env);
         console.log(colors.magenta(`📦 Processing package: ${packageName}`));
         await runCommand(`drizzle-kit ${action}`, packageDir, envFile);
         console.log(
            colors.green(`✅ ${packageName} ${action} completed successfully`),
         );
         results.push({ package: packageName, success: true });
      } catch (error) {
         console.log(
            colors.red(`❌ ${packageName} ${action} failed: ${error}`),
         );
         results.push({
            package: packageName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
         });
      }

      console.log(colors.cyan("─".repeat(50)));
   }

   const successCount = results.filter((result) => result.success).length;
   const failureCount = results.length - successCount;

   console.log(colors.blue("📊 Summary:"));
   console.log(colors.green(`✅ Success: ${successCount}`));
   console.log(colors.red(`❌ Failed: ${failureCount}`));

   if (failureCount === 0) {
      return;
   }

   console.log(colors.yellow("⚠️  Failed packages:"));

   for (const result of results.filter((entry) => !entry.success)) {
      console.log(colors.red(`   - ${result.package}: ${result.error}`));
   }

   process.exit(1);
}

function listEnvironments() {
   console.log(colors.blue("🔍 Available environments:"));

   for (const packageName of DATABASE_PACKAGES) {
      const packageDir = getPackageDirectory(packageName);

      if (!fs.existsSync(packageDir)) {
         continue;
      }

      console.log(colors.magenta(`\n📦 ${packageName}:`));

      const envFiles = fs
         .readdirSync(packageDir)
         .filter((file) => file.startsWith(".env") && !file.includes("example"))
         .sort();

      if (envFiles.length === 0) {
         console.log(colors.yellow("   No environment files found"));
         continue;
      }

      for (const file of envFiles) {
         console.log(colors.green(`   ✅ ${file}`));
      }
   }
}

async function checkStatus(env: string, packages: string[]) {
   console.log(
      colors.blue(`🔍 Checking database status for ${env} environment`),
   );
   console.log(colors.cyan("─".repeat(50)));

   const results: { package: string; success: boolean; error?: string }[] = [];

   for (const packageName of packages) {
      const packageDir = getPackageDirectory(packageName);

      if (!fs.existsSync(packageDir)) {
         console.log(
            colors.red(`❌ Package directory not found: ${packageDir}`),
         );
         results.push({
            package: packageName,
            success: false,
            error: "Directory not found",
         });
         continue;
      }

      try {
         const envFile = getEnvFilePath(packageDir, env);
         console.log(colors.magenta(`📦 Checking package: ${packageName}`));

         const packageJsonPath = path.join(packageDir, "package.json");
         const drizzleConfigPath = path.join(packageDir, "drizzle.config.ts");

         if (!fs.existsSync(packageJsonPath)) {
            throw new Error("package.json not found");
         }

         if (!fs.existsSync(drizzleConfigPath)) {
            throw new Error("drizzle.config.ts not found");
         }

         fs.readFileSync(envFile, "utf8");
         await runCommand(
            "drizzle-kit generate --custom --name healthcheck",
            packageDir,
            envFile,
         );

         console.log(
            colors.green(
               `✅ ${packageName} status check completed successfully`,
            ),
         );
         results.push({ package: packageName, success: true });
      } catch (error) {
         console.log(
            colors.red(`❌ ${packageName} status check failed: ${error}`),
         );
         results.push({
            package: packageName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
         });
      }

      console.log(colors.cyan("─".repeat(50)));
   }

   const successCount = results.filter((result) => result.success).length;
   const failureCount = results.length - successCount;

   console.log(colors.blue("📊 Status Summary:"));
   console.log(colors.green(`✅ Healthy: ${successCount}`));
   console.log(colors.red(`❌ Issues: ${failureCount}`));

   if (failureCount === 0) {
      console.log(
         colors.green("🎉 All database packages are properly configured!"),
      );
      return;
   }

   console.log(colors.yellow("⚠️  Packages with issues:"));

   for (const result of results.filter((entry) => !entry.success)) {
      console.log(colors.red(`   - ${result.package}: ${result.error}`));
   }

   process.exit(1);
}

const cli = cac("db-push");

cli.command("push")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option(
      "-p, --packages <packages>",
      "Comma-separated list of packages to run on",
   )
   .action(async (options) => {
      await runOnPackages("push", options.env, parsePackages(options.packages));
   });

cli.command("migrate")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option(
      "-p, --packages <packages>",
      "Comma-separated list of packages to run on",
   )
   .action(async (options) => {
      await runOnPackages(
         "migrate",
         options.env,
         parsePackages(options.packages),
      );
   });

cli.command("generate")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option(
      "-p, --packages <packages>",
      "Comma-separated list of packages to run on",
   )
   .action(async (options) => {
      await runOnPackages(
         "generate --custom",
         options.env,
         parsePackages(options.packages),
      );
   });

cli.command("studio")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option(
      "-p, --packages <packages>",
      "Comma-separated list of packages to run on",
   )
   .action(async (options) => {
      console.log(
         colors.yellow("🚨 Note: Studio will open in separate windows/tabs"),
      );
      await runOnPackages(
         "studio",
         options.env,
         parsePackages(options.packages),
      );
   });

cli.command("envs").action(() => {
   listEnvironments();
});

cli.command("status")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option(
      "-p, --packages <packages>",
      "Comma-separated list of packages to run on",
   )
   .action(async (options) => {
      await checkStatus(options.env, parsePackages(options.packages));
   });

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length === 0) {
   cli.outputHelp();
}
