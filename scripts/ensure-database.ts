import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import chalk from "chalk";
import { config as loadDotenv } from "dotenv";
import { cac } from "cac";

const colors = {
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
};

function getEnvFilePath(env: string) {
   const webDir = path.join(process.cwd(), "apps", "web");
   const possibleFiles = [
      `.env.${env}.local`,
      `.env.${env}`,
      ".env.local",
      ".env",
   ];

   for (const file of possibleFiles) {
      const filePath = path.join(webDir, file);
      if (fs.existsSync(filePath)) return filePath;
   }

   throw new Error(`No environment file found for ${env} in apps/web`);
}

async function ensureDatabase(databaseUrl: string) {
   const url = new URL(databaseUrl);
   const targetDb = decodeURIComponent(url.pathname.replace(/^\//, ""));

   if (!targetDb) {
      throw new Error("DATABASE_URL is missing database name");
   }

   const adminUrl = new URL(databaseUrl);
   adminUrl.pathname = "/postgres";

   const admin = new Client({ connectionString: adminUrl.toString() });
   await admin.connect();

   try {
      const exists = await admin.query(
         "SELECT 1 FROM pg_database WHERE datname = $1",
         [targetDb],
      );

      if (exists.rowCount && exists.rowCount > 0) {
         console.log(colors.cyan(`   Database "${targetDb}" already exists`));
         return;
      }

      await admin.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
      console.log(colors.green(`✅ Created database "${targetDb}"`));
   } finally {
      await admin.end();
   }
}

async function run(env: string) {
   const envFile = getEnvFilePath(env);
   console.log(colors.cyan(`   Loading env from: ${envFile}`));
   loadDotenv({ path: envFile, override: true });

   const databaseUrl = process.env.DATABASE_URL;

   if (!databaseUrl) {
      console.error(colors.red("❌ DATABASE_URL is not set"));
      process.exit(1);
   }

   await ensureDatabase(databaseUrl);
}

const cli = cac("ensure-database");

cli.command("")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .action(async (options) => {
      await run(options.env).catch((error) => {
         console.error(colors.red("Failed:"), error);
         process.exit(1);
      });
   });

cli.help();
cli.version("1.0.0");
cli.parse();
