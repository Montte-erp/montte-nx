---
name: "@montte/cli/accounts"
description: >
   Use when listing, inspecting, or creating bank accounts via the montte CLI.
   Covers account types (checking, savings, investment, payment, cash) and
   initial balance setup.
type: sub-skill
library: "@montte/cli"
library_version: "0.1.0"
sources:
   - "Montte-erp/montte-nx:libraries/cli/src/commands/accounts.ts"
---

# Bank Accounts

## `montte accounts list`

List all bank accounts for the authenticated team.

```bash
montte accounts list
montte accounts list --archived
montte accounts list --json
```

| Option       | Description               |
| ------------ | ------------------------- |
| `--archived` | Include archived accounts |
| `--json`     | Output raw JSON           |

Output columns: `id`, `name`, `type`, `status`, `balance`

## `montte accounts get <id>`

Get full details of a single bank account.

```bash
montte accounts get acc_abc123
montte accounts get acc_abc123 --json
```

## `montte accounts create`

Create a new bank account.

```bash
montte accounts create --name "Conta Corrente" --type checking --balance 1000.00
montte accounts create --name "Caixa" --type cash
```

| Option      | Required | Description                                                                     |
| ----------- | -------- | ------------------------------------------------------------------------------- |
| `--name`    | Yes      | Account name                                                                    |
| `--type`    | No       | `checking`, `savings`, `investment`, `payment`, or `cash` (default: `checking`) |
| `--balance` | No       | Initial balance as decimal (default: `0`)                                       |
| `--json`    | No       | Output raw JSON                                                                 |

## Account Types

| Type         | Description                              |
| ------------ | ---------------------------------------- |
| `checking`   | Conta corrente                           |
| `savings`    | Conta poupança                           |
| `investment` | Conta investimento                       |
| `payment`    | Conta de pagamento (e.g. Nubank, PicPay) |
| `cash`       | Caixa físico                             |
