import * as fs from "node:fs";
import * as path from "node:path";
import { createDb } from "@core/database/client";
import { eventCatalog } from "@core/database/schemas/event-catalog";
import { EVENT_CATEGORIES } from "@packages/events/catalog";
import { AI_EVENTS } from "@packages/events/ai";
import { CONTACT_EVENTS } from "@packages/events/contact";
import { DASHBOARD_EVENTS } from "@packages/events/dashboard";
import { DOCUMENT_EVENTS } from "@packages/events/document";
import { FINANCE_EVENTS } from "@packages/events/finance";
import { INSIGHT_EVENTS } from "@packages/events/insight";
import { INVENTORY_EVENTS } from "@packages/events/inventory";
import { NFE_EVENTS } from "@packages/events/nfe";
import { SERVICE_EVENTS } from "@packages/events/service";
import { WEBHOOK_EVENTS } from "@packages/events/webhook";
import chalk from "chalk";
import { cac } from "cac";
import { config } from "dotenv";

interface EventPricing {
   eventName: string;
   category: string;
   pricePerEvent: string;
   freeTierLimit: number;
   displayName: string;
   description: string;
   isBillable: boolean;
}

const EVENT_PRICING: EventPricing[] = [
   {
      eventName: FINANCE_EVENTS["finance.transaction_created"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.001000",
      freeTierLimit: 500,
      displayName: "Transação Financeira",
      description: "Registrada quando uma transação financeira é criada.",
      isBillable: true,
   },
   {
      eventName: FINANCE_EVENTS["finance.transaction_updated"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Transação Atualizada",
      description: "Registrada quando uma transação financeira é atualizada.",
      isBillable: false,
   },
   {
      eventName: FINANCE_EVENTS["finance.bank_account_connected"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Conta Bancária Conectada",
      description: "Registrada quando uma conta bancária é conectada.",
      isBillable: false,
   },
   {
      eventName: FINANCE_EVENTS["finance.category_created"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Categoria Criada",
      description: "Registrada quando uma categoria financeira é criada.",
      isBillable: false,
   },
   {
      eventName: FINANCE_EVENTS["finance.tag_created"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Tag Criada",
      description: "Registrada quando uma tag de transação é criada.",
      isBillable: false,
   },
   {
      eventName: WEBHOOK_EVENTS["webhook.endpoint.created"],
      category: EVENT_CATEGORIES.webhook,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Endpoint Criado",
      description: "Registrada quando um endpoint de webhook é criado.",
      isBillable: false,
   },
   {
      eventName: WEBHOOK_EVENTS["webhook.endpoint.updated"],
      category: EVENT_CATEGORIES.webhook,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Endpoint Atualizado",
      description: "Registrada quando um endpoint de webhook é atualizado.",
      isBillable: false,
   },
   {
      eventName: WEBHOOK_EVENTS["webhook.endpoint.deleted"],
      category: EVENT_CATEGORIES.webhook,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Endpoint Deletado",
      description: "Registrada quando um endpoint de webhook é deletado.",
      isBillable: false,
   },
   {
      eventName: WEBHOOK_EVENTS["webhook.delivered"],
      category: EVENT_CATEGORIES.webhook,
      pricePerEvent: "0.000500",
      freeTierLimit: 500,
      displayName: "Webhook Entregue",
      description: "Registrada por entrega bem-sucedida de webhook.",
      isBillable: true,
   },
   {
      eventName: DASHBOARD_EVENTS["dashboard.created"],
      category: EVENT_CATEGORIES.dashboard,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Dashboard Criado",
      description: "Registrada quando um novo dashboard é criado.",
      isBillable: false,
   },
   {
      eventName: DASHBOARD_EVENTS["dashboard.updated"],
      category: EVENT_CATEGORIES.dashboard,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Dashboard Atualizado",
      description: "Registrada quando um dashboard é atualizado.",
      isBillable: false,
   },
   {
      eventName: DASHBOARD_EVENTS["dashboard.deleted"],
      category: EVENT_CATEGORIES.dashboard,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Dashboard Deletado",
      description: "Registrada quando um dashboard é deletado.",
      isBillable: false,
   },
   {
      eventName: INSIGHT_EVENTS["insight.created"],
      category: EVENT_CATEGORIES.insight,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Insight Criado",
      description: "Registrada quando um novo insight é criado.",
      isBillable: false,
   },
   {
      eventName: INSIGHT_EVENTS["insight.updated"],
      category: EVENT_CATEGORIES.insight,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Insight Atualizado",
      description: "Registrada quando um insight é atualizado.",
      isBillable: false,
   },
   {
      eventName: INSIGHT_EVENTS["insight.deleted"],
      category: EVENT_CATEGORIES.insight,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Insight Deletado",
      description: "Registrada quando um insight é deletado.",
      isBillable: false,
   },
   {
      eventName: CONTACT_EVENTS["contact.created"],
      category: EVENT_CATEGORIES.contact,
      pricePerEvent: "0.010000",
      freeTierLimit: 50,
      displayName: "Contato Criado",
      description: "Registrada quando um contato é criado.",
      isBillable: true,
   },
   {
      eventName: CONTACT_EVENTS["contact.updated"],
      category: EVENT_CATEGORIES.contact,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Contato Atualizado",
      description: "Registrada quando um contato é atualizado.",
      isBillable: false,
   },
   {
      eventName: CONTACT_EVENTS["contact.deleted"],
      category: EVENT_CATEGORIES.contact,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Contato Deletado",
      description: "Registrada quando um contato é deletado.",
      isBillable: false,
   },
   {
      eventName: INVENTORY_EVENTS["inventory.item_created"],
      category: EVENT_CATEGORIES.inventory,
      pricePerEvent: "0.010000",
      freeTierLimit: 50,
      displayName: "Item de Estoque Criado",
      description: "Registrada quando um item de estoque é criado.",
      isBillable: true,
   },
   {
      eventName: INVENTORY_EVENTS["inventory.item_updated"],
      category: EVENT_CATEGORIES.inventory,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Item Atualizado",
      description: "Registrada quando um item de estoque é atualizado.",
      isBillable: false,
   },
   {
      eventName: INVENTORY_EVENTS["inventory.item_deleted"],
      category: EVENT_CATEGORIES.inventory,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Item Deletado",
      description: "Registrada quando um item de estoque é deletado.",
      isBillable: false,
   },
   {
      eventName: SERVICE_EVENTS["service.created"],
      category: EVENT_CATEGORIES.service,
      pricePerEvent: "0.010000",
      freeTierLimit: 20,
      displayName: "Serviço Criado",
      description: "Registrada quando um serviço é criado.",
      isBillable: true,
   },
   {
      eventName: SERVICE_EVENTS["service.updated"],
      category: EVENT_CATEGORIES.service,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Serviço Atualizado",
      description: "Registrada quando um serviço é atualizado.",
      isBillable: false,
   },
   {
      eventName: SERVICE_EVENTS["service.deleted"],
      category: EVENT_CATEGORIES.service,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Serviço Deletado",
      description: "Registrada quando um serviço é deletado.",
      isBillable: false,
   },
   {
      eventName: AI_EVENTS["ai.chat_message"],
      category: EVENT_CATEGORIES.ai,
      pricePerEvent: "0.020000",
      freeTierLimit: 50,
      displayName: "Mensagem de Chat IA",
      description: "Registrada quando uma mensagem é enviada ao chat de IA.",
      isBillable: true,
   },
   {
      eventName: AI_EVENTS["ai.agent_action"],
      category: EVENT_CATEGORIES.ai,
      pricePerEvent: "0.040000",
      freeTierLimit: 20,
      displayName: "Ação de Agente IA",
      description: "Registrada quando um agente de IA executa uma ação.",
      isBillable: true,
   },
   {
      eventName: AI_EVENTS["ai.keyword_derived"],
      category: EVENT_CATEGORIES.ai,
      pricePerEvent: "0.010000",
      freeTierLimit: 100,
      displayName: "Palavras-chave Derivadas",
      description:
         "Registrada quando palavras-chave são derivadas automaticamente para uma categoria financeira.",
      isBillable: true,
   },
   {
      eventName: DOCUMENT_EVENTS["document.signed"],
      category: EVENT_CATEGORIES.document,
      pricePerEvent: "0.050000",
      freeTierLimit: 10,
      displayName: "Documento Assinado",
      description: "Registrada quando um documento é assinado digitalmente.",
      isBillable: true,
   },
   {
      eventName: NFE_EVENTS["nfe.emitted"],
      category: EVENT_CATEGORIES.nfe,
      pricePerEvent: "0.020000",
      freeTierLimit: 20,
      displayName: "NF-e Emitida",
      description: "Registrada quando uma nota fiscal eletrônica é emitida.",
      isBillable: true,
   },
   {
      eventName: NFE_EVENTS["nfe.cancelled"],
      category: EVENT_CATEGORIES.nfe,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "NF-e Cancelada",
      description: "Registrada quando uma nota fiscal eletrônica é cancelada.",
      isBillable: false,
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
      printSummary(
         EVENT_PRICING.map(toSeedEntry) as Array<
            typeof eventCatalog.$inferSelect
         >,
      );
      console.log(
         colors.yellow("\n⚠️  DRY RUN completed - no data was modified"),
      );
      return;
   }

   const db = createDb({ databaseUrl });

   let deleted: Array<{ id: string }>;

   try {
      deleted = await db
         .delete(eventCatalog)
         .returning({ id: eventCatalog.id });
   } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      const rootMessage =
         cause instanceof Error
            ? cause.message
            : error instanceof Error
              ? error.message
              : String(error);

      if (
         rootMessage.includes("relation") &&
         rootMessage.includes("does not exist")
      ) {
         throw new Error(
            "Table platform.event_catalog does not exist. Run 'bun run db:push' first.",
         );
      }

      throw error;
   }

   console.log(`Deleted ${deleted.length} existing catalog entries.`);

   const inserted = await db
      .insert(eventCatalog)
      .values(EVENT_PRICING.map(toSeedEntry))
      .returning();

   printSummary(inserted);
   console.log(colors.green("\n--- Done ---"));
}

async function checkCatalog(env: string) {
   loadEnv(env);
   const databaseUrl = requireDatabaseUrl();

   console.log(colors.blue("🔍 Checking event catalog drift...\n"));

   try {
      const db = createDb({ databaseUrl });
      const rows = await db
         .select({ eventName: eventCatalog.eventName })
         .from(eventCatalog);

      const dbNames = new Set(rows.map((row) => row.eventName));
      const codeNames = new Set(EVENT_PRICING.map((entry) => entry.eventName));
      const missingInDb = [...codeNames].filter((name) => !dbNames.has(name));
      const extraInDb = [...dbNames].filter((name) => !codeNames.has(name));

      if (missingInDb.length > 0) {
         console.log(
            colors.red(
               `❌ ${missingInDb.length} event(s) defined in code but missing from DB catalog:`,
            ),
         );

         for (const name of missingInDb) {
            console.log(colors.red(`   - ${name}`));
         }
      }

      if (extraInDb.length > 0) {
         console.log(
            colors.yellow(
               `⚠️  ${extraInDb.length} event(s) in DB catalog but not defined in code (stale rows):`,
            ),
         );

         for (const name of extraInDb) {
            console.log(colors.yellow(`   - ${name}`));
         }
      }

      if (missingInDb.length === 0 && extraInDb.length === 0) {
         console.log(
            colors.green(
               `✅ Catalog is in sync. ${codeNames.size} events match.`,
            ),
         );
         return;
      }

      console.log(
         colors.red("\n❌ Catalog drift detected. Run: bun run seed:events"),
      );
      process.exit(1);
   } catch (error) {
      console.error(
         colors.red("❌ Failed to connect to database or query event_catalog:"),
         error,
      );
      process.exit(1);
   }
}

const cli = cac("seed-event-catalog");

cli.command("run")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .option("--dry-run", "Preview changes without modifying data")
   .action(async (options) => {
      await runSeed(options.env, Boolean(options.dryRun)).catch((error) => {
         console.error(colors.red("Seed failed:"), error);
         process.exit(1);
      });
   });

cli.command("check")
   .option("-e, --env <environment>", "Environment to use", {
      default: "local",
   })
   .action(async (options) => {
      await checkCatalog(options.env);
   });

cli.help();
cli.version("1.0.0");
cli.parse();

if (cli.args.length === 0) {
   cli.outputHelp();
}
