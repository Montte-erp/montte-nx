import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "pg";
import chalk from "chalk";
import { config as loadDotenv } from "dotenv";
import { cac } from "cac";

const REQUIRED_SCHEMAS = ["auth", "finance", "crm", "inventory", "platform"];

const colors = {
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
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

async function run(env: string) {
   const envFile = getEnvFilePath(env);
   console.log(colors.cyan(`   Loading env from: ${envFile}`));
   loadDotenv({ path: envFile });

   const databaseUrl = process.env.DATABASE_URL;

   if (!databaseUrl) {
      console.error(colors.red("❌ DATABASE_URL is not set"));
      process.exit(1);
   }

   const client = new Client({ connectionString: databaseUrl });
   await client.connect();

   try {
      for (const schema of REQUIRED_SCHEMAS) {
         await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      }
      console.log(
         colors.green(`✅ Schemas ready: ${REQUIRED_SCHEMAS.join(", ")}`),
      );
   } finally {
      await client.end();
   }
}

const cli = cac("ensure-schemas");

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
