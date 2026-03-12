import type { CAC } from "cac";
import { requireConfig } from "../config";
import { createClient } from "../client";
import { printJson, printTable, printRecord } from "../output";

export function registerAccountsCommands(cli: CAC): void {
   cli.command("accounts list", "List bank accounts")
      .option("--json", "Output as JSON")
      .option("--archived", "Include archived accounts")
      .action(async (options: { json?: boolean; archived?: boolean }) => {
         const config = requireConfig();
         const client = createClient(config.apiKey, config.host);
         const accounts = await client.accounts.list({
            includeArchived: options.archived,
         });
         if (options.json) return printJson(accounts);
         printTable(
            accounts.map((a) => ({
               id: a.id,
               name: a.name,
               type: a.type,
               status: a.status,
               balance: a.currentBalance,
            })),
         );
      });

   cli.command("accounts get <id>", "Get bank account details")
      .option("--json", "Output as JSON")
      .action(async (id: string, options: { json?: boolean }) => {
         const config = requireConfig();
         const client = createClient(config.apiKey, config.host);
         const account = await client.accounts.get({ id });
         if (options.json) return printJson(account);
         printRecord(account);
      });

   cli.command("accounts create", "Create a bank account")
      .option("--name <name>", "Account name")
      .option(
         "--type <type>",
         "Account type (checking, savings, investment, payment, cash)",
      )
      .option("--balance <balance>", "Initial balance")
      .option("--json", "Output as JSON")
      .action(
         async (options: {
            name: string;
            type?: string;
            balance?: string;
            json?: boolean;
         }) => {
            const config = requireConfig();
            const client = createClient(config.apiKey, config.host);
            const account = await client.accounts.create({
               name: options.name,
               type: (options.type as any) ?? "checking",
               initialBalance: options.balance ?? "0",
            });
            if (options.json) return printJson(account);
            console.log(`Created account: ${account.name} (${account.id})`);
         },
      );
}
