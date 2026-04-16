---
name: "@montte/cli/transactions"
description: >
   Use when listing, filtering, creating, summarizing, or deleting financial
   transactions via the montte CLI. Covers all options for date ranges, types,
   account/category filters, and pagination.
type: sub-skill
library: "@montte/cli"
library_version: "0.1.0"
sources:
   - "Montte-erp/montte-nx:libraries/cli/src/commands/transactions.ts"
---

# Transactions

## `montte transactions list`

List transactions with optional filters. Returns paginated results.

```bash
montte transactions list
montte transactions list --type expense --from 2024-01-01 --to 2024-01-31
montte transactions list --account <bank-account-id> --limit 50
montte transactions list --search "internet" --json
```

| Option            | Description                        |
| ----------------- | ---------------------------------- |
| `--type <type>`   | `income`, `expense`, or `transfer` |
| `--from <date>`   | Start date `YYYY-MM-DD`            |
| `--to <date>`     | End date `YYYY-MM-DD`              |
| `--account <id>`  | Filter by bank account ID          |
| `--category <id>` | Filter by category ID              |
| `--search <term>` | Search by name/description         |
| `--page <n>`      | Page number (default: 1)           |
| `--limit <n>`     | Page size (default: 25)            |
| `--json`          | Output raw JSON                    |

## `montte transactions get <id>`

Get full details of a single transaction.

```bash
montte transactions get txn_abc123
montte transactions get txn_abc123 --json
```

## `montte transactions create`

Create a new transaction.

```bash
montte transactions create \
  --type expense \
  --amount 99.90 \
  --date 2024-03-15 \
  --name "Subscription" \
  --account <bank-account-id> \
  --category <category-id>
```

| Option       | Required | Description                        |
| ------------ | -------- | ---------------------------------- |
| `--type`     | Yes      | `income`, `expense`, or `transfer` |
| `--amount`   | Yes      | Decimal amount (e.g. `150.00`)     |
| `--date`     | Yes      | Date `YYYY-MM-DD`                  |
| `--name`     | No       | Description                        |
| `--account`  | No       | Bank account ID                    |
| `--category` | No       | Category ID                        |
| `--json`     | No       | Output raw JSON                    |

## `montte transactions summary`

Get aggregated totals (income, expense, balance) for a period.

```bash
montte transactions summary --from 2024-01-01 --to 2024-12-31
montte transactions summary --type expense --json
```

| Option   | Description             |
| -------- | ----------------------- |
| `--from` | Start date `YYYY-MM-DD` |
| `--to`   | End date `YYYY-MM-DD`   |
| `--type` | Filter by type          |
| `--json` | Output raw JSON         |

## `montte transactions remove <id>`

Permanently delete a transaction.

```bash
montte transactions remove txn_abc123
```
