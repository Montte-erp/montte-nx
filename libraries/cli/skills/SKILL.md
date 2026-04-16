---
name: "@montte/cli/overview"
description: >
   Use when an agent needs to install, set up, or run any montte CLI command.
   Covers authentication, global flags, and available command groups.
type: core
library: "@montte/cli"
library_version: "0.1.0"
sources:
   - "Montte-erp/montte-nx:libraries/cli/src/index.ts"
   - "Montte-erp/montte-nx:libraries/cli/src/config.ts"
---

# Montte CLI

The Montte CLI (`@montte/cli`) lets you manage your Montte ERP data — transactions, bank accounts, categories, and budgets — directly from the terminal.

## Installation

```bash
npm install -g @montte/cli
# or
npx @montte/cli <command>
```

## Authentication

Before running any command you must authenticate with your API key. Get your key from the Montte dashboard under Settings → Integrações.

```bash
montte login --key <your-api-key>
```

Optionally point at a custom host (self-hosted or staging):

```bash
montte login --key <key> --host https://api.staging.montte.com
```

Check current auth status:

```bash
montte whoami
```

Log out (removes stored credentials):

```bash
montte logout
```

Credentials are stored in `~/.montte/config.json`. You can also use environment variables instead:

```bash
MONTTE_API_KEY=<key> MONTTE_HOST=<host> montte <command>
```

## Global Flags

All commands support:

| Flag     | Description                                  |
| -------- | -------------------------------------------- |
| `--json` | Output raw JSON instead of a formatted table |
| `--help` | Show help for the command                    |

## Command Groups

| Group                 | Description                                       |
| --------------------- | ------------------------------------------------- |
| `montte transactions` | List, get, create, summarize, remove transactions |
| `montte accounts`     | List, get, create bank accounts                   |
| `montte categories`   | List, create, archive, remove categories          |
| `montte budgets`      | List, get, create, remove monthly budget goals    |

## Quick Start Example

```bash
# Authenticate
montte login --key mnt_live_xxxx

# List recent transactions
montte transactions list --from 2024-01-01 --to 2024-01-31

# Create an expense
montte transactions create \
  --type expense \
  --amount 150.00 \
  --date 2024-01-15 \
  --name "Internet bill" \
  --category <category-id>

# Check budget usage for January 2024
montte budgets list --month 1 --year 2024
```
