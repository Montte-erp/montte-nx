#!/usr/bin/env bun
import cac from "cac";
import { registerAuthCommands } from "./commands/auth";
import { registerAccountsCommands } from "./commands/accounts";
import { registerTransactionsCommands } from "./commands/transactions";
import { registerCategoriesCommands } from "./commands/categories";
import { registerBudgetsCommands } from "./commands/budgets";

const cli = cac("montte");

registerAuthCommands(cli);
registerAccountsCommands(cli);
registerTransactionsCommands(cli);
registerCategoriesCommands(cli);
registerBudgetsCommands(cli);

cli.help();
cli.version("0.1.0");

cli.parse();
