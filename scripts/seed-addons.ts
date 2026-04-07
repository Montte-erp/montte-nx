import * as fs from "node:fs";
import * as path from "node:path";
import { createDb } from "@core/database/client";
import { subscription } from "@core/database/schemas/auth";
import { organization } from "@core/database/schemas/auth";
import { AddonName } from "@core/stripe/constants";
import chalk from "chalk";
import { cac } from "cac";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

interface AddonDefinition {
   plan: AddonName;
   displayName: string;
   description: string;
   monthlyPriceCents: number;
}

const ADDON_CATALOG: AddonDefinition[] = [
   {
      plan: AddonName.BOOST,
      displayName: "Boost",
      description:
         "Multiplica os limites gratuitos por 5 e libera automações avançadas.",
      monthlyPriceCents: 4900,
   },
   {
      plan: AddonName.SCALE,
      displayName: "Scale",
      description:
         "Multiplica os limites gratuitos por 20, prioridade de suporte e SLA garantido.",
      monthlyPriceCents: 14900,
   },
   {
      plan: AddonName.ENTERPRISE,
      displayName: "Enterprise",
      description:
         "Limites ilimitados, instância dedicada e contrato personalizado.",
      monthlyPriceCents: 49900,
   },
];

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
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
      if (fs.existsSync(filePath)) return filePath;
   }
   throw new Error(`No environment file found for ${env} in apps/web`);
}

function loadEnv(env: string) {
   const envFile = getEnvFilePath(env);
   console.log(colors.cyan(`   Loading env from: ${envFile}`));
   config({ path: envFile });
}

function requireDatabaseUrl() {
   const databaseUrl = process.env.DATABASE_URL;
   if (!databaseUrl) {
      console.error(colors.red("❌ DATABASE_URL is required"));
      process.exit(1);
   }
   return databaseUrl;
}

async function runSeed(
   env: string,
   dryRun: boolean,
   organizationSlug: string,
   addonNames: string[],
) {
   console.log(colors.blue("--- Addon Seed ---\n"));
   console.log(colors.cyan(`   Environment:       ${env}`));
   console.log(colors.cyan(`   Organization slug: ${organizationSlug}`));
   console.log(
      colors.cyan(`   Addons:            ${addonNames.join(", ") || "all"}`),
   );
   console.log(
      colors.cyan(`   Mode:              ${dryRun ? "DRY RUN" : "LIVE"}`),
   );
   console.log(colors.cyan("-".repeat(50)));

   loadEnv(env);
   const databaseUrl = requireDatabaseUrl();

   const db = createDb({ databaseUrl });

   const org = await db.query.organization.findFirst({
      where: (fields, { eq }) => eq(fields.slug, organizationSlug),
   });

   if (!org) {
      console.error(
         colors.red(
            `❌ Organization with slug "${organizationSlug}" not found`,
         ),
      );
      process.exit(1);
   }

   const toSeed =
      addonNames.length > 0
         ? ADDON_CATALOG.filter((a) => addonNames.includes(a.plan))
         : ADDON_CATALOG;

   if (toSeed.length === 0) {
      console.error(
         colors.red(
            `❌ No matching addons found. Valid names: ${ADDON_CATALOG.map((a) => a.plan).join(", ")}`,
         ),
      );
      process.exit(1);
   }

   console.log(`\nOrganization: ${org.name} (${org.id})`);
   console.log(`Addons to seed: ${toSeed.map((a) => a.plan).join(", ")}\n`);

   if (dryRun) {
      for (const addon of toSeed) {
         console.log(
            `  ${addon.plan.padEnd(12)} ${addon.displayName} — R$ ${(addon.monthlyPriceCents / 100).toFixed(2)}/mês`,
         );
      }
      console.log(
         colors.yellow("\n⚠️  DRY RUN completed - no data was modified"),
      );
      return;
   }

   const now = new Date();
   const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

   for (const addon of toSeed) {
      const existing = await db.query.subscription.findFirst({
         where: (fields, { and, eq }) =>
            and(eq(fields.referenceId, org.id), eq(fields.plan, addon.plan)),
      });

      if (existing) {
         await db
            .update(subscription)
            .set({
               status: "active",
               periodStart: now,
               periodEnd,
               cancelAtPeriodEnd: false,
            })
            .where(eq(subscription.id, existing.id));
         if (existing.status !== "active") {
            console.log(
               colors.yellow(
                  `  ⚠️  Reactivated previously ${existing.status} addon: ${addon.plan}`,
               ),
            );
         } else {
            console.log(
               colors.green(`  ✅ Updated existing addon: ${addon.plan}`),
            );
         }
      } else {
         await db.insert(subscription).values({
            plan: addon.plan,
            referenceId: org.id,
            status: "active",
            periodStart: now,
            periodEnd,
            cancelAtPeriodEnd: false,
         });
         console.log(colors.green(`  ✅ Inserted new addon: ${addon.plan}`));
      }
   }

   console.log(colors.green("\n--- Done ---"));
}

async function checkAddons(env: string, organizationSlug: string) {
   loadEnv(env);
   const databaseUrl = requireDatabaseUrl();
   const db = createDb({ databaseUrl });

   const org = await db.query.organization.findFirst({
      where: (fields, { eq }) => eq(fields.slug, organizationSlug),
   });

   if (!org) {
      console.error(
         colors.red(`❌ Organization "${organizationSlug}" not found`),
      );
      process.exit(1);
   }

   const rows = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, org.id));

   if (rows.length === 0) {
      console.log(
         colors.yellow(
            `⚠️  No addon subscriptions found for "${organizationSlug}"`,
         ),
      );
      return;
   }

   console.log(
      colors.blue(`🔍 Addon subscriptions for "${org.name}" (${org.id}):\n`),
   );
   for (const row of rows) {
      const status =
         row.status === "active"
            ? colors.green(row.status)
            : colors.yellow(row.status ?? "unknown");
      console.log(
         `  ${row.plan.padEnd(14)} status=${status}  expires=${row.periodEnd?.toISOString() ?? "—"}`,
      );
   }
}

const cli = cac("seed-addons");

cli.command("run")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option("-o, --org <slug>", "Organization slug to seed addons for", {
      default: "local",
   })
   .option(
      "-a, --addons <names>",
      "Comma-separated addon names (boost,scale,enterprise)",
      {
         default: "",
      },
   )
   .option("--dry-run", "Preview changes without modifying data")
   .action(async (options) => {
      const addonNames = options.addons
         ? (options.addons as string)
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
         : [];
      await runSeed(
         options.env,
         Boolean(options.dryRun),
         options.org,
         addonNames,
      ).catch((error) => {
         console.error(colors.red("Seed failed:"), error);
         process.exit(1);
      });
   });

cli.command("check")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option("-o, --org <slug>", "Organization slug to check", {
      default: "local",
   })
   .action(async (options) => {
      await checkAddons(options.env, options.org);
   });

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length === 0) {
   cli.outputHelp();
}
