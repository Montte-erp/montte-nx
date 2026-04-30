import * as fs from "node:fs";
import * as path from "node:path";
import { createDb } from "@core/database/client";
import { dashboards } from "@core/database/schemas/dashboards";
import { insights } from "@core/database/schemas/insights";
import { DEFAULT_INSIGHTS } from "@modules/insights/defaults";
import chalk from "chalk";
import { cac } from "cac";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
   gray: chalk.gray,
};

const DATABASE_PACKAGE_DIR = path.join(process.cwd(), "apps", "web");

function getEnvFilePath(env: string) {
   const possibleFiles = [
      `.env.${env}.local`,
      `.env.${env}`,
      ".env.local",
      ".env",
   ];

   for (const file of possibleFiles) {
      const filePath = path.join(DATABASE_PACKAGE_DIR, file);

      if (fs.existsSync(filePath)) {
         return filePath;
      }
   }

   throw new Error(`No environment file found for ${env} in apps/web`);
}

function loadEnv(env: string) {
   const envFile = getEnvFilePath(env);
   console.log(colors.cyan(`   Loading env from: ${envFile}`));
   config({ path: envFile, override: true });
}

function requireDatabaseUrl() {
   const databaseUrl = process.env.DATABASE_URL;

   if (!databaseUrl) {
      console.error(colors.red("❌ DATABASE_URL is required"));
      process.exit(1);
   }

   return databaseUrl;
}

async function runSeed(env: string, dryRun: boolean) {
   console.log(colors.blue("--- Default Dashboard Seeding ---\n"));
   console.log(colors.cyan(`   Environment: ${env}`));
   console.log(colors.cyan(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`));
   console.log(colors.cyan("-".repeat(50)));

   loadEnv(env);
   const db = createDb({ databaseUrl: requireDatabaseUrl() });

   console.log(colors.blue("\n🔍 Finding dashboards without tiles...\n"));

   const allDashboards = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.isDefault, true));

   console.log(
      colors.gray(`   Found ${allDashboards.length} default dashboard(s)\n`),
   );

   const emptyDashboards = allDashboards.filter(
      (dashboard) => dashboard.tiles.length === 0,
   );

   if (emptyDashboards.length === 0) {
      console.log(
         colors.green(
            "✅ All default dashboards already have tiles. Nothing to do!",
         ),
      );
      return;
   }

   console.log(
      colors.yellow(
         `   ${emptyDashboards.length} dashboard(s) need default tiles\n`,
      ),
   );

   let totalInsightsCreated = 0;
   let totalDashboardsUpdated = 0;

   for (const dashboard of emptyDashboards) {
      console.log(
         colors.blue(
            `📊 Processing: ${colors.cyan(dashboard.name)} (${dashboard.id})`,
         ),
      );

      const existingInsights = await db
         .select()
         .from(insights)
         .where(eq(insights.organizationId, dashboard.organizationId));

      let insightIds: string[];

      if (existingInsights.length >= DEFAULT_INSIGHTS.length) {
         console.log(
            colors.gray(
               `   ℹ️  Using ${existingInsights.length} existing insights`,
            ),
         );
         insightIds = existingInsights
            .slice(0, DEFAULT_INSIGHTS.length)
            .map((insight) => insight.id);
      } else if (dryRun) {
         console.log(
            colors.yellow(
               `   [DRY RUN] Would create ${DEFAULT_INSIGHTS.length} insights`,
            ),
         );
         insightIds = Array.from(
            { length: DEFAULT_INSIGHTS.length },
            () => "mock-id",
         );
      } else {
         console.log(
            colors.cyan(
               `   ➕ Creating ${DEFAULT_INSIGHTS.length} default insights...`,
            ),
         );

         const created = await db
            .insert(insights)
            .values(
               DEFAULT_INSIGHTS.map((definition) => ({
                  organizationId: dashboard.organizationId,
                  teamId: dashboard.teamId,
                  createdBy: dashboard.createdBy,
                  name: definition.name,
                  description: definition.description,
                  type: definition.type,
                  config: definition.config as Record<string, unknown>,
                  defaultSize: definition.defaultSize,
               })),
            )
            .returning({ id: insights.id });

         insightIds = created.map((entry) => entry.id);
         totalInsightsCreated += insightIds.length;
         console.log(
            colors.green(`   ✓ Created ${insightIds.length} insights`),
         );
      }

      const tiles = insightIds.map((insightId, index) => ({
         insightId,
         size: DEFAULT_INSIGHTS[index]?.defaultSize || "md",
         order: index,
      }));

      if (dryRun) {
         console.log(
            colors.yellow(
               `   [DRY RUN] Would add ${tiles.length} tiles to "${dashboard.name}"\n`,
            ),
         );
         continue;
      }

      await db
         .update(dashboards)
         .set({ tiles })
         .where(eq(dashboards.id, dashboard.id));

      totalDashboardsUpdated++;
      console.log(
         colors.green(
            `   ✓ Added ${tiles.length} tiles to "${dashboard.name}"\n`,
         ),
      );
   }

   console.log(colors.cyan("-".repeat(50)));
   console.log(colors.blue("\n📊 Summary:\n"));

   if (dryRun) {
      console.log(
         colors.yellow(
            `   Would update ${emptyDashboards.length} dashboard(s)`,
         ),
      );
      console.log(
         colors.yellow(
            `   Would create ~${DEFAULT_INSIGHTS.length * emptyDashboards.length} insight(s)`,
         ),
      );
      console.log(colors.yellow("\n⚠️  DRY RUN - no data was modified\n"));
      return;
   }

   console.log(
      colors.green(`   ✓ Updated ${totalDashboardsUpdated} dashboard(s)`),
   );
   console.log(colors.green(`   ✓ Created ${totalInsightsCreated} insight(s)`));
   console.log(colors.green("\n✅ Seeding complete!\n"));
}

function checkConfiguration(env: string) {
   loadEnv(env);

   console.log(colors.blue("🔍 Checking configuration...\n"));

   if (!process.env.DATABASE_URL) {
      console.log(colors.red("❌ DATABASE_URL is not set"));
      process.exit(1);
   }

   console.log(colors.green("✅ DATABASE_URL is set"));
   console.log(
      colors.green(`✅ ${DEFAULT_INSIGHTS.length} default insights configured`),
   );
}

const cli = cac("seed-default-dashboard");

cli.command("run")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option("--dry-run", "Preview changes without modifying data")
   .action(async (options) => {
      await runSeed(options.env, Boolean(options.dryRun)).catch((error) => {
         console.error(colors.red("\n❌ Seed failed:"), error);
         process.exit(1);
      });
   });

cli.command("check")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .action((options) => {
      checkConfiguration(options.env);
   });

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length === 0) {
   cli.outputHelp();
}
