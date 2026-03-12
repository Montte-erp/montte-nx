import type { CAC } from "cac";
import { requireConfig } from "../config";
import { createClient } from "../client";
import { printJson, printTable, printRecord } from "../output";

export function registerBudgetsCommands(cli: CAC): void {
   cli.command("budgets list", "List budget goals for a month")
      .option("--month <n>", "Month (1-12)", { required: true })
      .option("--year <n>", "Year", { required: true })
      .option("--json", "Output as JSON")
      .action(
         async (options: { month: number; year: number; json?: boolean }) => {
            const config = requireConfig();
            const client = createClient(config.apiKey, config.host);
            const goals = await client.budgets.list({
               month: Number(options.month),
               year: Number(options.year),
            });
            if (options.json) return printJson(goals);
            printTable(
               goals.map((g) => ({
                  id: g.id,
                  category: g.categoryId,
                  limit: g.limitAmount,
                  spent: g.currentSpent,
                  percent: `${g.percentUsed}%`,
               })),
            );
         },
      );

   cli.command("budgets get <id>", "Get budget goal details")
      .option("--json", "Output as JSON")
      .action(async (id: string, options: { json?: boolean }) => {
         const config = requireConfig();
         const client = createClient(config.apiKey, config.host);
         const goal = await client.budgets.get({ id });
         if (options.json) return printJson(goal);
         printRecord(goal);
      });

   cli.command("budgets create", "Create a budget goal")
      .option("--category <id>", "Category ID", { required: true })
      .option("--month <n>", "Month (1-12)", { required: true })
      .option("--year <n>", "Year", { required: true })
      .option("--limit <amount>", "Limit amount", { required: true })
      .option("--alert <n>", "Alert threshold percentage (1-100)")
      .option("--json", "Output as JSON")
      .action(
         async (options: {
            category: string;
            month: number;
            year: number;
            limit: string;
            alert?: number;
            json?: boolean;
         }) => {
            const config = requireConfig();
            const client = createClient(config.apiKey, config.host);
            const goal = await client.budgets.create({
               categoryId: options.category,
               month: Number(options.month),
               year: Number(options.year),
               limitAmount: options.limit,
               alertThreshold: options.alert
                  ? Number(options.alert)
                  : undefined,
            });
            if (options.json) return printJson(goal);
            console.log(`Created budget goal: ${goal.id}`);
         },
      );

   cli.command("budgets remove <id>", "Delete a budget goal").action(
      async (id: string) => {
         const config = requireConfig();
         const client = createClient(config.apiKey, config.host);
         await client.budgets.remove({ id });
         console.log("Budget goal deleted.");
      },
   );
}
