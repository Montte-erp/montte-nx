# @montte/cli

Command-line interface for [Montte](https://montte.com.br) — manage transactions, accounts, categories, and budgets from your terminal.

## Installation

```bash
npm install -g @montte/cli
# or
bun add -g @montte/cli
```

## Authentication

```bash
montte login --key <your-api-key>
```

Your API key is stored in `~/.montte/config.json`. You can also set it via environment variable instead:

```bash
export MONTTE_API_KEY=<your-api-key>
```

```bash
montte whoami   # verify current credentials
montte logout   # remove stored credentials
```

## Commands

### Transactions

```bash
montte transactions list
montte transactions list --type expense --from 2024-01-01 --to 2024-01-31
montte transactions list --account <id> --category <id> --search groceries
montte transactions list --page 2 --limit 50

montte transactions get <id>
montte transactions create --type expense --amount 150.00 --date 2024-01-15 --name "Lunch"
montte transactions summary --from 2024-01-01 --to 2024-01-31
montte transactions remove <id>
```

### Accounts

```bash
montte accounts list
montte accounts list --archived
montte accounts get <id>
montte accounts create --name "Main Checking" --type checking --balance 1000.00
```

Account types: `checking`, `savings`, `investment`, `payment`, `cash`

### Categories

```bash
montte categories list
montte categories list --type expense
montte categories create --name "Food" --type expense --color "#ff5500"
montte categories create --name "Restaurants" --type expense --parent <id>
montte categories archive <id>
montte categories remove <id>
```

### Budgets

```bash
montte budgets list --month 1 --year 2024
montte budgets get <id>
montte budgets create --category <id> --month 1 --year 2024 --limit 500.00
montte budgets create --category <id> --month 1 --year 2024 --limit 500.00 --alert 80
montte budgets remove <id>
```

## JSON Output

Every command supports `--json` for machine-readable output:

```bash
montte transactions list --json | jq '.data[].amount'
montte accounts list --json | jq '.[] | select(.type == "checking")'
```

## Custom API Host

```bash
montte login --key <key> --host https://your-self-hosted-instance.com
# or
export MONTTE_HOST=https://your-self-hosted-instance.com
```

## Programmatic Usage

The package also exports a typed API client for use in scripts:

```typescript
import { createClient } from "@montte/cli";

const client = createClient("your-api-key");

const { data, total } = await client.transactions.list({
  type: "expense",
  dateFrom: "2024-01-01",
  dateTo: "2024-01-31",
  page: 1,
  pageSize: 25,
});
```

The contract types are available via the `@montte/cli/contract` subpath:

```typescript
import type { contract } from "@montte/cli/contract";
```
