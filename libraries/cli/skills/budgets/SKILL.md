---
name: "@montte/cli/budgets"
description: >
   Use when creating or checking monthly budget goals per category via the montte CLI.
   Covers listing progress (percent used), alert thresholds, and removing goals.
type: sub-skill
library: "@montte/cli"
library_version: "0.1.0"
sources:
   - "Montte-erp/montte-nx:libraries/cli/src/commands/budgets.ts"
---

# Budget Goals

Budget goals set spending limits per category per month and optionally trigger an alert when a threshold is reached.

## `montte budgets list`

List all budget goals for a given month.

```bash
montte budgets list --month 1 --year 2024
montte budgets list --month 3 --year 2024 --json
```

| Option    | Required | Description         |
| --------- | -------- | ------------------- |
| `--month` | Yes      | Month number `1-12` |
| `--year`  | Yes      | Four-digit year     |
| `--json`  | No       | Output raw JSON     |

Output columns: `id`, `category`, `limit`, `spent`, `percent`

## `montte budgets get <id>`

Get details of a single budget goal.

```bash
montte budgets get bgt_abc123
montte budgets get bgt_abc123 --json
```

## `montte budgets create`

Create a monthly budget goal for a category.

```bash
montte budgets create \
  --category <category-id> \
  --month 1 \
  --year 2024 \
  --limit 500.00 \
  --alert 80
```

| Option       | Required | Description                                   |
| ------------ | -------- | --------------------------------------------- |
| `--category` | Yes      | Category ID                                   |
| `--month`    | Yes      | Month `1-12`                                  |
| `--year`     | Yes      | Four-digit year                               |
| `--limit`    | Yes      | Spending limit as decimal                     |
| `--alert`    | No       | Alert threshold `1-100` (percentage of limit) |
| `--json`     | No       | Output raw JSON                               |

## `montte budgets remove <id>`

Delete a budget goal.

```bash
montte budgets remove bgt_abc123
```

## Workflow Example

```bash
# Get your expense categories
montte categories list --type expense --json

# Set a R$500 budget for Alimentação in March 2024, alert at 80%
montte budgets create \
  --category cat_alimentacao \
  --month 3 \
  --year 2024 \
  --limit 500.00 \
  --alert 80

# Check progress mid-month
montte budgets list --month 3 --year 2024
```
