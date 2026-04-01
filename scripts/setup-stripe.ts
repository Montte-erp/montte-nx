import * as fs from "node:fs";
import * as path from "node:path";
import Stripe from "stripe";
import {
   EVENT_PRICES,
   STRIPE_METER_EVENTS,
} from "@core/stripe/constants";
import { of, toMinorUnitsString } from "@f-o-t/money";
import chalk from "chalk";
import { cac } from "cac";
import { config } from "dotenv";

const DISPLAY_NAMES: Record<string, string> = {
   "finance.transaction_created": "Transação Financeira",
   "webhook.delivered": "Webhook Entregue",
   "contact.created": "Contato Criado",
   "inventory.item_created": "Item de Estoque Criado",
   "service.created": "Serviço Criado",
};

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
      if (fs.existsSync(filePath)) return filePath;
   }
   throw new Error(`No environment file found for ${env} in apps/web`);
}

function loadEnv(env: string) {
   const envFile = getEnvFilePath(env);
   console.log(colors.cyan(`   Loading env from: ${envFile}`));
   config({ path: envFile });
}

function requireStripeKey(): string {
   const key = process.env.STRIPE_SECRET_KEY;
   if (!key) {
      console.error(colors.red("❌ STRIPE_SECRET_KEY is required"));
      process.exit(1);
   }
   return key;
}

interface MeterSetupEntry {
   eventName: string;
   meterEventName: string;
   displayName: string;
   pricePerEvent: string;
}

function buildEntries(): MeterSetupEntry[] {
   return Object.entries(STRIPE_METER_EVENTS).map(([eventName, meterEventName]) => ({
      eventName,
      meterEventName,
      displayName: DISPLAY_NAMES[eventName] ?? eventName,
      pricePerEvent: EVENT_PRICES[eventName] ?? "0",
   }));
}

async function runSetup(env: string, dryRun: boolean) {
   console.log(colors.blue("--- Stripe Meter Setup ---\n"));
   console.log(colors.cyan(`   Environment: ${env}`));
   console.log(colors.cyan(`   Mode:        ${dryRun ? "DRY RUN" : "LIVE"}`));
   console.log(colors.cyan("-".repeat(50)));

   loadEnv(env);
   const stripeKey = requireStripeKey();
   const stripe = new Stripe(stripeKey);

   const entries = buildEntries();

   if (dryRun) {
      console.log(`\nWould create ${entries.length} meters + ${entries.length} products + ${entries.length} prices:\n`);
      for (const e of entries) {
         console.log(
            `  ${e.meterEventName.padEnd(35)} R$ ${Number(e.pricePerEvent).toFixed(6)}/event  — ${e.displayName}`,
         );
      }
      console.log(colors.yellow("\n⚠️  DRY RUN completed - no data was modified"));
      return;
   }

   const existingMeters = await stripe.billing.meters.list({ limit: 100 });
   const meterByEventName = new Map(
      existingMeters.data.map((m) => [m.event_name, m]),
   );

   let created = 0;
   let skipped = 0;
   let failed = 0;

   for (const entry of entries) {
      process.stdout.write(`  ${entry.meterEventName.padEnd(35)} `);

      try {
         let meter = meterByEventName.get(entry.meterEventName);

         if (meter) {
            process.stdout.write(colors.gray("meter exists  "));
            skipped++;
         } else {
            meter = await stripe.billing.meters.create({
               display_name: entry.displayName,
               event_name: entry.meterEventName,
               default_aggregation: { formula: "sum" },
               value_settings: { event_payload_key: "value" },
            });
            process.stdout.write(colors.green("meter created "));
            created++;
         }

         const existingProducts = await stripe.products.search({
            query: `metadata['montte_event_name']:'${entry.eventName}'`,
            limit: 1,
         });

         let productId: string;
         if (existingProducts.data[0]) {
            productId = existingProducts.data[0].id;
            process.stdout.write(colors.gray("product exists  "));
         } else {
            const product = await stripe.products.create({
               name: entry.displayName,
               metadata: { montte_event_name: entry.eventName },
            });
            productId = product.id;
            process.stdout.write(colors.green("product created "));
         }

         const existingPrices = await stripe.prices.list({
            product: productId,
            type: "recurring",
            limit: 10,
         });
         const hasActivePrice = existingPrices.data.some((p) => p.active);

         if (hasActivePrice) {
            process.stdout.write(colors.gray("price exists"));
         } else {
            await stripe.prices.create({
               product: productId,
               currency: "brl",
               billing_scheme: "per_unit",
               unit_amount_decimal: toMinorUnitsString(of(entry.pricePerEvent, "BRL")),
               recurring: {
                  interval: "month",
                  usage_type: "metered",
                  meter: meter.id,
               },
            });
            process.stdout.write(colors.green("price created"));
         }

         console.log();
      } catch (error) {
         console.log(colors.red(`FAILED — ${error instanceof Error ? error.message : String(error)}`));
         failed++;
      }
   }

   console.log(`\n${"─".repeat(50)}`);
   console.log(`  Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`);

   if (failed > 0) {
      console.log(colors.red(`\n❌ ${failed} entries failed. Re-run to retry.`));
      process.exit(1);
   }

   console.log(colors.green("\n✅ Stripe meter setup complete"));
}

async function checkSetup(env: string) {
   loadEnv(env);
   const stripeKey = requireStripeKey();
   const stripe = new Stripe(stripeKey);

   console.log(colors.blue("🔍 Checking Stripe meter drift...\n"));

   const existingMeters = await stripe.billing.meters.list({ limit: 100 });
   const meterNames = new Set(existingMeters.data.map((m) => m.event_name));
   const expectedNames = new Set(Object.values(STRIPE_METER_EVENTS));

   const missing = [...expectedNames].filter((n) => !meterNames.has(n));
   const extra = [...meterNames].filter((n) => !expectedNames.has(n));

   if (missing.length > 0) {
      console.log(colors.red(`❌ ${missing.length} meter(s) missing from Stripe:`));
      for (const name of missing) console.log(colors.red(`   - ${name}`));
   }

   if (extra.length > 0) {
      console.log(colors.yellow(`⚠️  ${extra.length} meter(s) in Stripe not in code (stale):`));
      for (const name of extra) console.log(colors.yellow(`   - ${name}`));
   }

   if (missing.length === 0 && extra.length === 0) {
      console.log(colors.green(`✅ All ${expectedNames.size} meters present in Stripe`));
      return;
   }

   console.log(colors.red("\n❌ Drift detected. Run: bun run setup:stripe"));
   process.exit(1);
}

const cli = cac("setup-stripe");

cli
   .command("run")
   .option("-e, --env <environment>", "Environment to use", { default: "local" })
   .option("--dry-run", "Preview changes without modifying data")
   .action(async (options) => {
      await runSetup(options.env, Boolean(options.dryRun)).catch((error) => {
         console.error(colors.red("Setup failed:"), error);
         process.exit(1);
      });
   });

cli
   .command("check")
   .option("-e, --env <environment>", "Environment to use", { default: "local" })
   .action(async (options) => {
      await checkSetup(options.env).catch((error) => {
         console.error(colors.red("Check failed:"), error);
         process.exit(1);
      });
   });

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length === 0) {
   cli.outputHelp();
}
