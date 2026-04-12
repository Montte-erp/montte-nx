import * as fs from "node:fs";
import * as path from "node:path";
import { createDb } from "@core/database/client";
import { categories } from "@core/database/schemas/categories";
import { and, eq, isNull, or } from "drizzle-orm";
import chalk from "chalk";
import { cac } from "cac";
import { config } from "dotenv";

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
};

const DEFAULT_CATEGORY_METADATA: Record<
   string,
   { icon: string; color?: string }
> = {
   Vendas: { icon: "briefcase", color: "#22c55e" },
   Produtos: { icon: "package" },
   Serviços: { icon: "briefcase" },
   "Outras Receitas": { icon: "wallet", color: "#14b8a6" },
   Custos: { icon: "shopping-cart", color: "#ef4444" },
   CMV: { icon: "package" },
   "Serviços de Terceiros": { icon: "briefcase" },
   "Despesas Operacionais": { icon: "briefcase", color: "#f97316" },
   Administrativo: { icon: "briefcase" },
   Comercial: { icon: "shopping-cart" },
   Marketing: { icon: "gift" },
   Pessoal: { icon: "heart", color: "#ec4899" },
   Impostos: { icon: "wallet", color: "#f59e0b" },
   "Tarifas Bancárias": { icon: "credit-card", color: "#78716c" },
   Tecnologia: { icon: "smartphone", color: "#6366f1" },
   Transferências: { icon: "zap", color: "#06b6d4" },
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

async function runBackfill(env: string, dryRun: boolean) {
   console.log(colors.blue("--- Backfill Category Icons & Colors ---\n"));
   console.log(colors.cyan(`   Environment: ${env}`));
   console.log(colors.cyan(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`));
   console.log(colors.cyan("-".repeat(50)));

   loadEnv(env);
   const databaseUrl = requireDatabaseUrl();
   const db = createDb({ databaseUrl });

   const targets = await db.query.categories.findMany({
      where: (fields, { and, eq, or, isNull }) =>
         and(
            eq(fields.isDefault, true),
            or(isNull(fields.icon), isNull(fields.color)),
         ),
      columns: { id: true, name: true, icon: true, color: true, level: true },
   });

   const toUpdate = targets.filter((c) => DEFAULT_CATEGORY_METADATA[c.name]);

   console.log(`\nFound ${toUpdate.length} default categories to patch:\n`);

   let updated = 0;
   for (const category of toUpdate) {
      const meta = DEFAULT_CATEGORY_METADATA[category.name];
      if (!meta) continue;

      const patch: { icon?: string; color?: string } = {};
      if (!category.icon && meta.icon) patch.icon = meta.icon;
      if (!category.color && meta.color) patch.color = meta.color;

      if (Object.keys(patch).length === 0) continue;

      const parts = [];
      if (patch.icon) parts.push(`icon=${patch.icon}`);
      if (patch.color) parts.push(`color=${patch.color}`);
      console.log(
         `  ${dryRun ? "[dry]" : "→"} "${category.name}" — ${parts.join(", ")}`,
      );

      if (!dryRun) {
         await db
            .update(categories)
            .set(patch)
            .where(eq(categories.id, category.id));
      }

      updated++;
   }

   console.log(
      `\n${dryRun ? colors.yellow(`⚠️  DRY RUN — ${updated} categories would be patched`) : colors.green(`✓ Patched ${updated} categories`)}`,
   );
   console.log(colors.blue("\n--- Done ---"));
}

const cli = cac("backfill-category-icons");

cli.command("run", "Backfill icons and colors for existing default categories")
   .option("--env <env>", "Environment (local, staging, production)", {
      default: "local",
   })
   .option("--dry-run", "Preview changes without writing to DB")
   .action(async (options) => {
      await runBackfill(options.env, options.dryRun ?? false);
      process.exit(0);
   });

cli.command("check", "Preview changes without writing to DB")
   .option("--env <env>", "Environment", { default: "local" })
   .action(async (options) => {
      await runBackfill(options.env, true);
      process.exit(0);
   });

cli.help();
cli.parse();
