import type { CAC } from "cac";
import { requireConfig } from "../config";
import { createClient } from "../client";
import { printJson, printTable, printRecord } from "../output";

export function registerTransactionsCommands(cli: CAC): void {
   cli.command("transactions list", "List transactions")
      .option("--json", "Output as JSON")
      .option("--type <type>", "Filter by type (income, expense, transfer)")
      .option("--from <date>", "Start date (YYYY-MM-DD)")
      .option("--to <date>", "End date (YYYY-MM-DD)")
      .option("--account <id>", "Filter by bank account ID")
      .option("--category <id>", "Filter by category ID")
      .option("--search <term>", "Search by name")
      .option("--page <n>", "Page number", { default: 1 })
      .option("--limit <n>", "Page size", { default: 25 })
      .action(
         async (options: {
            json?: boolean;
            type?: string;
            from?: string;
            to?: string;
            account?: string;
            category?: string;
            search?: string;
            page?: number;
            limit?: number;
         }) => {
            const config = requireConfig();
            const client = createClient(config.apiKey, config.host);
            const result = await client.transactions.list({
               type: options.type as any,
               dateFrom: options.from,
               dateTo: options.to,
               bankAccountId: options.account,
               categoryId: options.category,
               search: options.search,
               page: Number(options.page),
               pageSize: Number(options.limit),
            });
            if (options.json) return printJson(result);
            console.log(`Total: ${result.total}`);
            printTable(
               result.data.map((t) => ({
                  id: t.id,
                  date: t.date,
                  type: t.type,
                  name: t.name ?? "-",
                  amount: t.amount,
                  category: t.categoryId ?? "-",
               })),
            );
         },
      );

   cli.command("transactions get <id>", "Get transaction details")
      .option("--json", "Output as JSON")
      .action(async (id: string, options: { json?: boolean }) => {
         const config = requireConfig();
         const client = createClient(config.apiKey, config.host);
         const tx = await client.transactions.get({ id });
         if (options.json) return printJson(tx);
         printRecord(tx);
      });

   cli.command("transactions create", "Create a transaction")
      .option("--type <type>", "Type (income, expense, transfer)")
      .option("--amount <amount>", "Amount")
      .option("--date <date>", "Date (YYYY-MM-DD)")
      .option("--name <name>", "Name/description")
      .option("--account <id>", "Bank account ID")
      .option("--category <id>", "Category ID")
      .option("--json", "Output as JSON")
      .action(
         async (options: {
            type: string;
            amount: string;
            date: string;
            name?: string;
            account?: string;
            category?: string;
            json?: boolean;
         }) => {
            const config = requireConfig();
            const client = createClient(config.apiKey, config.host);
            const tx = await client.transactions.create({
               type: options.type as any,
               amount: options.amount,
               date: options.date,
               name: options.name,
               bankAccountId: options.account,
               categoryId: options.category,
            });
            if (options.json) return printJson(tx);
            console.log(
               `Created transaction: ${tx.name ?? tx.id} (${tx.amount})`,
            );
         },
      );

   cli.command("transactions summary", "Get transactions summary")
      .option("--json", "Output as JSON")
      .option("--from <date>", "Start date (YYYY-MM-DD)")
      .option("--to <date>", "End date (YYYY-MM-DD)")
      .option("--type <type>", "Filter by type")
      .action(
         async (options: {
            json?: boolean;
            from?: string;
            to?: string;
            type?: string;
         }) => {
            const config = requireConfig();
            const client = createClient(config.apiKey, config.host);
            const summary = await client.transactions.summary({
               dateFrom: options.from,
               dateTo: options.to,
               type: options.type as any,
            });
            if (options.json) return printJson(summary);
            printRecord(summary);
         },
      );

   cli.command("transactions remove <id>", "Delete a transaction").action(
      async (id: string) => {
         const config = requireConfig();
         const client = createClient(config.apiKey, config.host);
         await client.transactions.remove({ id });
         console.log("Transaction deleted.");
      },
   );
}
