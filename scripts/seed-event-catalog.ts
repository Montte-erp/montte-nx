import * as fs from "node:fs";
import * as path from "node:path";
import { createDb } from "@packages/database/client";
import { eventCatalog } from "@packages/database/schemas/event-catalog";
import { AI_EVENTS } from "@packages/events/ai";
import { EVENT_CATEGORIES } from "@packages/events/catalog";
import { DASHBOARD_EVENTS } from "@packages/events/dashboard";
import { FINANCE_EVENTS } from "@packages/events/finance";
import { INSIGHT_EVENTS } from "@packages/events/insight";
import { WEBHOOK_EVENTS } from "@packages/events/webhook";
import chalk from "chalk";
import { Command } from "commander";
import { config } from "dotenv";

// ---------------------------------------------------------------------------
// Event catalog seed data
// ---------------------------------------------------------------------------

interface EventPricing {
   eventName: string;
   category: string;
   pricePerEvent: string; // decimal string, e.g. "0.001000"
   freeTierLimit: number;
   displayName: string;
   description: string;
   isBillable: boolean;
}

const EVENT_PRICING: EventPricing[] = [
   // Finance
   { eventName: FINANCE_EVENTS["finance.transaction_created"], category: EVENT_CATEGORIES.finance, pricePerEvent: "0.000500", freeTierLimit: 1_000, displayName: "Transaction Created", description: "Fired when a financial transaction is recorded.", isBillable: true },
   { eventName: FINANCE_EVENTS["finance.transaction_updated"], category: EVENT_CATEGORIES.finance, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Transaction Updated", description: "Fired when a financial transaction is updated.", isBillable: false },
   { eventName: FINANCE_EVENTS["finance.bank_account_connected"], category: EVENT_CATEGORIES.finance, pricePerEvent: "0.001000", freeTierLimit: 10, displayName: "Bank Account Connected", description: "Fired when a bank account is connected.", isBillable: true },
   { eventName: FINANCE_EVENTS["finance.category_created"], category: EVENT_CATEGORIES.finance, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Category Created", description: "Fired when a spending category is created.", isBillable: false },
   { eventName: FINANCE_EVENTS["finance.tag_created"], category: EVENT_CATEGORIES.finance, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Tag Created", description: "Fired when a transaction tag is created.", isBillable: false },
   // AI
   { eventName: AI_EVENTS["ai.completion"], category: EVENT_CATEGORIES.ai, pricePerEvent: "0.003000", freeTierLimit: 100, displayName: "AI Completion (FIM)", description: "Tracks a single AI fill-in-the-middle completion.", isBillable: true },
   { eventName: AI_EVENTS["ai.chat_message"], category: EVENT_CATEGORIES.ai, pricePerEvent: "0.020000", freeTierLimit: 50, displayName: "AI Chat Message", description: "Tracks a single AI chat message exchange.", isBillable: true },
   { eventName: AI_EVENTS["ai.agent_action"], category: EVENT_CATEGORIES.ai, pricePerEvent: "0.040000", freeTierLimit: 20, displayName: "AI Agent Action", description: "Tracks a discrete action performed by an AI agent.", isBillable: true },
   { eventName: AI_EVENTS["ai.image_generation"], category: EVENT_CATEGORIES.ai, pricePerEvent: "0.900000", freeTierLimit: 5, displayName: "AI Image Generation", description: "Tracks a single AI image generation request.", isBillable: true },
   // Webhooks
   { eventName: WEBHOOK_EVENTS["webhook.endpoint.created"], category: EVENT_CATEGORIES.webhook, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Webhook Endpoint Created", description: "Fired when a webhook endpoint is created.", isBillable: false },
   { eventName: WEBHOOK_EVENTS["webhook.endpoint.updated"], category: EVENT_CATEGORIES.webhook, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Webhook Endpoint Updated", description: "Fired when a webhook endpoint configuration is updated.", isBillable: false },
   { eventName: WEBHOOK_EVENTS["webhook.endpoint.deleted"], category: EVENT_CATEGORIES.webhook, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Webhook Endpoint Deleted", description: "Fired when a webhook endpoint is deleted.", isBillable: false },
   { eventName: WEBHOOK_EVENTS["webhook.delivered"], category: EVENT_CATEGORIES.webhook, pricePerEvent: "0.000500", freeTierLimit: 500, displayName: "Webhook Delivered", description: "Fired when a webhook payload is delivered to an endpoint.", isBillable: true },
   // Dashboards
   { eventName: DASHBOARD_EVENTS["dashboard.created"], category: EVENT_CATEGORIES.dashboard, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Dashboard Created", description: "Fired when a new dashboard is created.", isBillable: false },
   { eventName: DASHBOARD_EVENTS["dashboard.updated"], category: EVENT_CATEGORIES.dashboard, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Dashboard Updated", description: "Fired when a dashboard configuration is updated.", isBillable: false },
   { eventName: DASHBOARD_EVENTS["dashboard.deleted"], category: EVENT_CATEGORIES.dashboard, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Dashboard Deleted", description: "Fired when a dashboard is deleted.", isBillable: false },
   // Insights
   { eventName: INSIGHT_EVENTS["insight.created"], category: EVENT_CATEGORIES.insight, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Insight Created", description: "Fired when a new insight is created.", isBillable: false },
   { eventName: INSIGHT_EVENTS["insight.updated"], category: EVENT_CATEGORIES.insight, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Insight Updated", description: "Fired when an insight is updated.", isBillable: false },
   { eventName: INSIGHT_EVENTS["insight.deleted"], category: EVENT_CATEGORIES.insight, pricePerEvent: "0.000000", freeTierLimit: 0, displayName: "Insight Deleted", description: "Fired when an insight is deleted.", isBillable: false },
];

function toSeedEntry(pricing: EventPricing) {
   return {
      eventName: pricing.eventName,
      category: pricing.category,
      pricePerEvent: pricing.pricePerEvent,
      freeTierLimit: pricing.freeTierLimit,
      displayName: pricing.displayName,
      description: pricing.description,
      isBillable: pricing.isBillable,
   };
}

// ---------------------------------------------------------------------------

const program = new Command();

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
};

const DATABASE_PACKAGE_DIR = path.join(process.cwd(), "packages", "database");

function getEnvFilePath(env: string): string {
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

   throw new Error(`No environment file found for ${env} in packages/database`);
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

function printSummary(inserted: Array<typeof eventCatalog.$inferSelect>) {
   const billableCount = inserted.filter((entry) => entry.isBillable).length;
   const nonBillableCount = inserted.length - billableCount;
   const withFreeTier = inserted.filter((entry) => entry.freeTierLimit > 0);

   console.log(`\nInserted ${inserted.length} catalog entries.`);
   console.log(`  Billable:     ${billableCount}`);
   console.log(`  Non-billable: ${nonBillableCount}`);
   console.log("\nFree tier allocations:");

   for (const entry of withFreeTier) {
      console.log(
         `  ${entry.eventName.padEnd(28)} ${entry.freeTierLimit.toLocaleString()} events`,
      );
   }
}

async function runSeed(env: string, dryRun: boolean) {
   console.log(colors.blue("--- Event Catalog Seed ---\n"));
   console.log(colors.cyan(`   Environment: ${env}`));
   console.log(colors.cyan(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`));
   console.log(colors.cyan("-".repeat(50)));

   loadEnv(env);
   const databaseUrl = requireDatabaseUrl();

   if (dryRun) {
      const inserted = EVENT_PRICING.map(toSeedEntry);
      printSummary(inserted as Array<typeof eventCatalog.$inferSelect>);
      console.log(
         colors.yellow("\n⚠️  DRY RUN completed - no data was modified"),
      );
      return;
   }

   const db = createDb({ databaseUrl });

   const deleted = await db
      .delete(eventCatalog)
      .returning({ id: eventCatalog.id });
   console.log(`Deleted ${deleted.length} existing catalog entries.`);

   const inserted = await db
      .insert(eventCatalog)
      .values(EVENT_PRICING.map(toSeedEntry))
      .returning();

   printSummary(inserted);
   console.log(colors.green("\n--- Done ---"));
}

program
   .name("seed-event-catalog")
   .description("Seed the event_catalog table")
   .version("1.0.0");

program
   .command("run")
   .description("Seed the event catalog")
   .option(
      "-e, --env <environment>",
      "Environment to use (local, production, etc.)",
      "local",
   )
   .option("--dry-run", "Preview changes without modifying data", false)
   .action(async (options) => {
      await runSeed(options.env, options.dryRun).catch((err) => {
         console.error(colors.red("Seed failed:"), err);
         process.exit(1);
      });
   });

program
   .command("check")
   .description("Diff EVENT_PRICING code definitions against the live event_catalog table. Exits non-zero on drift.")
   .option(
      "-e, --env <environment>",
      "Environment to use (local, production, etc.)",
      "local",
   )
   .action(async (options) => {
      loadEnv(options.env);
      const databaseUrl = requireDatabaseUrl();

      console.log(colors.blue("🔍 Checking event catalog drift...\n"));

      try {
         const db = createDb({ databaseUrl });

         const rows = await db
            .select({ eventName: eventCatalog.eventName })
            .from(eventCatalog);

         const dbNames = new Set(rows.map((r) => r.eventName));
         const codeNames = new Set(EVENT_PRICING.map((e) => e.eventName));

         const missingInDb = [...codeNames].filter((n) => !dbNames.has(n));
         const extraInDb = [...dbNames].filter((n) => !codeNames.has(n));

         if (missingInDb.length > 0) {
            console.log(colors.red(`❌ ${missingInDb.length} event(s) defined in code but missing from DB catalog:`));
            for (const name of missingInDb) {
               console.log(colors.red(`   - ${name}`));
            }
         }

         if (extraInDb.length > 0) {
            console.log(colors.yellow(`⚠️  ${extraInDb.length} event(s) in DB catalog but not defined in code (stale rows):`));
            for (const name of extraInDb) {
               console.log(colors.yellow(`   - ${name}`));
            }
         }

         if (missingInDb.length === 0 && extraInDb.length === 0) {
            console.log(colors.green(`✅ Catalog is in sync. ${codeNames.size} events match.`));
            process.exit(0);
         } else {
            console.log(colors.red("\n❌ Catalog drift detected. Run: bun run seed:events run"));
            process.exit(1);
         }
      } catch (err) {
         console.error(colors.red("❌ Failed to connect to database or query event_catalog:"), err);
         process.exit(1);
      }
   });

program.parse();
