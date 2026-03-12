# @montte/cli Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `@montte/cli` — a CLI tool with embedded oRPC contract that the server implements. Self-contained, publishable to npm, usable by humans and AI agents.

**Architecture:** The CLI package lives at `libraries/cli/`. It contains its own Zod schemas and oRPC contract (no imports from `@core/*`). The server (`apps/server/`) imports the contract via `@montte/cli/contract` and implements it with `implement(contract)`. The CLI itself uses `@orpc/client` + `ContractRouterClient` to call the server.

**Tech Stack:** cac (CLI framework), @orpc/contract, @orpc/client, zod

---

### Task 1: Delete SDK and clean references

**Files:**
- Delete: `libraries/sdk/` (entire directory)
- Modify: `apps/server/package.json` — remove `@contentta/sdk` dependency
- Modify: `package.json` — verify workspaces still valid

**Step 1: Delete SDK directory**

```bash
rm -rf libraries/sdk
```

**Step 2: Remove SDK dependency from server**

In `apps/server/package.json`, remove:
```json
"@contentta/sdk": "workspace:*",
```

**Step 3: Verify no remaining imports**

```bash
grep -rn '@contentta/sdk' apps/ packages/ core/
```

Expected: no results

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove @contentta/sdk package"
```

---

### Task 2: Scaffold CLI package

**Files:**
- Create: `libraries/cli/package.json`
- Create: `libraries/cli/tsconfig.json`

**Step 1: Create package.json**

```json
{
   "name": "@montte/cli",
   "version": "0.1.0",
   "private": false,
   "description": "Montte CLI — manage your finances from the terminal",
   "type": "module",
   "bin": {
      "montte": "./src/index.ts"
   },
   "exports": {
      ".": {
         "types": "./src/index.ts",
         "bun": "./src/index.ts",
         "import": "./src/index.ts"
      },
      "./contract": {
         "types": "./src/contract/index.ts",
         "bun": "./src/contract/index.ts",
         "import": "./src/contract/index.ts"
      }
   },
   "files": [
      "src",
      "README.md"
   ],
   "publishConfig": {
      "access": "public"
   },
   "scripts": {
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@orpc/client": "catalog:orpc",
      "@orpc/contract": "catalog:orpc",
      "cac": "^6.7.14",
      "zod": "4.3.6"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "@types/bun": "latest",
      "typescript": "catalog:development"
   }
}
```

**Step 2: Create tsconfig.json**

```json
{
   "extends": "@tooling/typescript/library.json",
   "compilerOptions": {
      "paths": {}
   },
   "include": ["src"]
}
```

**Step 3: Install deps**

```bash
bun install
```

**Step 4: Commit**

```bash
git add libraries/cli/
git commit -m "chore: scaffold @montte/cli package"
```

---

### Task 3: Define contract schemas

**Files:**
- Create: `libraries/cli/src/contract/schemas.ts`

These are self-contained Zod schemas — NO imports from `@core/database`. They mirror the DB schemas but are independently defined for the public API surface.

**Step 1: Write schemas**

```typescript
import { z } from "zod"

// === Shared ===

const uuid = z.string().uuid()
const numericString = z.string().regex(/^-?\d+(\.\d{1,2})?$/)
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// === Bank Accounts ===

export const bankAccountTypeEnum = z.enum([
   "checking", "savings", "investment", "payment", "cash",
])

export const bankAccountStatusEnum = z.enum(["active", "archived"])

export const BankAccountSchema = z.object({
   id: uuid,
   name: z.string(),
   type: bankAccountTypeEnum,
   status: bankAccountStatusEnum,
   color: z.string(),
   iconUrl: z.string().nullable(),
   bankCode: z.string().nullable(),
   bankName: z.string().nullable(),
   branch: z.string().nullable(),
   accountNumber: z.string().nullable(),
   initialBalance: numericString,
   initialBalanceDate: dateString.nullable(),
   notes: z.string().nullable(),
   currentBalance: numericString,
   projectedBalance: numericString,
   createdAt: z.string(),
   updatedAt: z.string(),
})

export const CreateBankAccountSchema = z.object({
   name: z.string().min(2).max(100),
   type: bankAccountTypeEnum.default("checking"),
   color: z.string().default("#6366f1"),
   initialBalance: numericString.default("0"),
   initialBalanceDate: dateString.optional(),
   bankCode: z.string().optional(),
   bankName: z.string().optional(),
   branch: z.string().optional(),
   accountNumber: z.string().optional(),
   iconUrl: z.string().optional(),
   notes: z.string().optional(),
})

export const UpdateBankAccountSchema = CreateBankAccountSchema.partial()

// === Transactions ===

export const transactionTypeEnum = z.enum(["income", "expense", "transfer"])

export const paymentMethodEnum = z.enum([
   "pix", "credit_card", "debit_card", "boleto",
   "cash", "transfer", "other", "cheque", "automatic_debit",
])

export const TransactionSchema = z.object({
   id: uuid,
   name: z.string().nullable(),
   type: transactionTypeEnum,
   amount: numericString,
   description: z.string().nullable(),
   date: dateString,
   bankAccountId: uuid.nullable(),
   destinationBankAccountId: uuid.nullable(),
   creditCardId: uuid.nullable(),
   categoryId: uuid.nullable(),
   contactId: uuid.nullable(),
   paymentMethod: paymentMethodEnum.nullable(),
   attachmentUrl: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
})

export const CreateTransactionSchema = z.object({
   name: z.string().min(2).max(200).nullable().optional(),
   type: transactionTypeEnum,
   amount: numericString,
   date: dateString,
   description: z.string().max(500).nullable().optional(),
   bankAccountId: uuid.nullable().optional(),
   destinationBankAccountId: uuid.nullable().optional(),
   creditCardId: uuid.nullable().optional(),
   categoryId: uuid.nullable().optional(),
   contactId: uuid.nullable().optional(),
   paymentMethod: paymentMethodEnum.nullable().optional(),
   attachmentUrl: z.string().nullable().optional(),
   tagIds: z.array(uuid).optional(),
})

export const UpdateTransactionSchema = CreateTransactionSchema
   .omit({ type: true })
   .partial()

export const ListTransactionsFilterSchema = z.object({
   type: transactionTypeEnum.optional(),
   bankAccountId: uuid.optional(),
   categoryId: uuid.optional(),
   tagId: uuid.optional(),
   contactId: uuid.optional(),
   creditCardId: uuid.optional(),
   dateFrom: dateString.optional(),
   dateTo: dateString.optional(),
   search: z.string().optional(),
   uncategorized: z.boolean().optional(),
   paymentMethod: paymentMethodEnum.optional(),
   page: z.number().int().min(1).default(1),
   pageSize: z.number().int().min(1).max(100).default(25),
})

export const TransactionSummarySchema = z.object({
   totalCount: z.number(),
   incomeTotal: numericString,
   expenseTotal: numericString,
   balance: numericString,
})

export const PaginatedTransactionsSchema = z.object({
   data: z.array(TransactionSchema),
   total: z.number(),
})

// === Categories ===

export const categoryTypeEnum = z.enum(["income", "expense"])

export const CategorySchema = z.object({
   id: uuid,
   parentId: uuid.nullable(),
   name: z.string(),
   type: categoryTypeEnum,
   level: z.number(),
   description: z.string().nullable(),
   isDefault: z.boolean(),
   color: z.string().nullable(),
   icon: z.string().nullable(),
   isArchived: z.boolean(),
   keywords: z.array(z.string()).nullable(),
   notes: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
})

export const CreateCategorySchema = z.object({
   name: z.string().min(2).max(100),
   type: categoryTypeEnum,
   parentId: uuid.nullable().optional(),
   description: z.string().max(255).nullable().optional(),
   color: z.string().nullable().optional(),
   icon: z.string().max(50).nullable().optional(),
   keywords: z.array(z.string().min(1).max(60)).max(20).nullable().optional(),
   notes: z.string().max(500).nullable().optional(),
})

export const UpdateCategorySchema = CreateCategorySchema
   .omit({ type: true })
   .partial()

// === Budget Goals ===

export const BudgetGoalSchema = z.object({
   id: uuid,
   categoryId: uuid,
   month: z.number(),
   year: z.number(),
   limitAmount: numericString,
   alertThreshold: z.number().nullable(),
   currentSpent: numericString,
   percentUsed: z.number(),
   createdAt: z.string(),
   updatedAt: z.string(),
})

export const CreateBudgetGoalSchema = z.object({
   categoryId: uuid,
   month: z.number().int().min(1).max(12),
   year: z.number().int().min(2020),
   limitAmount: numericString,
   alertThreshold: z.number().int().min(1).max(100).nullable().optional(),
})

export const UpdateBudgetGoalSchema = z.object({
   limitAmount: numericString.optional(),
   alertThreshold: z.number().int().min(1).max(100).nullable().optional(),
})

export const ListBudgetGoalsFilterSchema = z.object({
   month: z.number().int().min(1).max(12),
   year: z.number().int().min(2020),
})
```

**Step 2: Commit**

```bash
git add libraries/cli/src/contract/
git commit -m "feat(cli): define contract schemas"
```

---

### Task 4: Define oRPC contract

**Files:**
- Create: `libraries/cli/src/contract/router.ts`
- Create: `libraries/cli/src/contract/index.ts`

**Step 1: Write contract router**

```typescript
import { oc } from "@orpc/contract"
import {
   BankAccountSchema,
   CreateBankAccountSchema,
   UpdateBankAccountSchema,
   TransactionSchema,
   CreateTransactionSchema,
   UpdateTransactionSchema,
   ListTransactionsFilterSchema,
   TransactionSummarySchema,
   PaginatedTransactionsSchema,
   CategorySchema,
   CreateCategorySchema,
   UpdateCategorySchema,
   BudgetGoalSchema,
   CreateBudgetGoalSchema,
   UpdateBudgetGoalSchema,
   ListBudgetGoalsFilterSchema,
} from "./schemas"
import { z } from "zod"

const uuid = z.string().uuid()

export const contract = {
   accounts: {
      list: oc
         .input(z.object({ includeArchived: z.boolean().optional() }))
         .output(z.array(BankAccountSchema)),
      get: oc
         .input(z.object({ id: uuid }))
         .output(BankAccountSchema),
      create: oc
         .input(CreateBankAccountSchema)
         .output(BankAccountSchema),
      update: oc
         .input(z.object({ id: uuid }).merge(UpdateBankAccountSchema))
         .output(BankAccountSchema),
      remove: oc
         .input(z.object({ id: uuid }))
         .output(z.object({ success: z.literal(true) })),
   },

   transactions: {
      list: oc
         .input(ListTransactionsFilterSchema)
         .output(PaginatedTransactionsSchema),
      get: oc
         .input(z.object({ id: uuid }))
         .output(TransactionSchema),
      create: oc
         .input(CreateTransactionSchema)
         .output(TransactionSchema),
      update: oc
         .input(z.object({ id: uuid }).merge(UpdateTransactionSchema))
         .output(TransactionSchema),
      remove: oc
         .input(z.object({ id: uuid }))
         .output(z.object({ success: z.literal(true) })),
      summary: oc
         .input(ListTransactionsFilterSchema)
         .output(TransactionSummarySchema),
   },

   categories: {
      list: oc
         .input(z.object({
            type: z.enum(["income", "expense"]).optional(),
            includeArchived: z.boolean().optional(),
         }))
         .output(z.array(CategorySchema)),
      create: oc
         .input(CreateCategorySchema)
         .output(CategorySchema),
      update: oc
         .input(z.object({ id: uuid }).merge(UpdateCategorySchema))
         .output(CategorySchema),
      remove: oc
         .input(z.object({ id: uuid }))
         .output(z.object({ success: z.literal(true) })),
      archive: oc
         .input(z.object({ id: uuid }))
         .output(CategorySchema),
   },

   budgets: {
      list: oc
         .input(ListBudgetGoalsFilterSchema)
         .output(z.array(BudgetGoalSchema)),
      get: oc
         .input(z.object({ id: uuid }))
         .output(BudgetGoalSchema),
      create: oc
         .input(CreateBudgetGoalSchema)
         .output(BudgetGoalSchema),
      update: oc
         .input(z.object({ id: uuid }).merge(UpdateBudgetGoalSchema))
         .output(BudgetGoalSchema),
      remove: oc
         .input(z.object({ id: uuid }))
         .output(z.object({ success: z.literal(true) })),
   },
}
```

**Step 2: Write contract index**

```typescript
export { contract } from "./router"
export * from "./schemas"
```

**Step 3: Commit**

```bash
git add libraries/cli/src/contract/
git commit -m "feat(cli): define oRPC contract"
```

---

### Task 5: CLI config and client

**Files:**
- Create: `libraries/cli/src/config.ts`
- Create: `libraries/cli/src/client.ts`

**Step 1: Write config module**

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const CONFIG_DIR = join(homedir(), ".montte")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

interface Config {
   apiKey: string
   host?: string
}

export function getConfig(): Config | null {
   if (process.env.MONTTE_API_KEY) {
      return {
         apiKey: process.env.MONTTE_API_KEY,
         host: process.env.MONTTE_HOST,
      }
   }

   if (!existsSync(CONFIG_FILE)) return null

   const raw = readFileSync(CONFIG_FILE, "utf-8")
   return JSON.parse(raw) as Config
}

export function saveConfig(config: Config): void {
   mkdirSync(CONFIG_DIR, { recursive: true })
   writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function clearConfig(): void {
   if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE)
}

export function requireConfig(): Config {
   const config = getConfig()
   if (!config) {
      console.error("Not logged in. Run: montte login --key <your-api-key>")
      process.exit(1)
   }
   return config
}
```

**Step 2: Write client module**

```typescript
import type { ContractRouterClient } from "@orpc/contract"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { contract } from "./contract"

const DEFAULT_HOST = "https://api.montte.com"

export function createClient(
   apiKey: string,
   host?: string,
): ContractRouterClient<typeof contract> {
   const link = new RPCLink({
      url: `${(host ?? DEFAULT_HOST).replace(/\/+$/, "")}/sdk/orpc`,
      headers: { "X-API-Key": apiKey },
   })
   return createORPCClient(link)
}
```

**Step 3: Commit**

```bash
git add libraries/cli/src/config.ts libraries/cli/src/client.ts
git commit -m "feat(cli): add config and oRPC client"
```

---

### Task 6: CLI output formatter

**Files:**
- Create: `libraries/cli/src/output.ts`

**Step 1: Write output module**

```typescript
export function printJson(data: unknown): void {
   console.log(JSON.stringify(data, null, 2))
}

export function printTable(
   rows: Record<string, unknown>[],
   columns?: string[],
): void {
   if (rows.length === 0) {
      console.log("No results.")
      return
   }

   const keys = columns ?? Object.keys(rows[0])
   const widths = keys.map((key) =>
      Math.max(key.length, ...rows.map((r) => String(r[key] ?? "").length)),
   )

   const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ")
   const separator = widths.map((w) => "-".repeat(w)).join("  ")

   console.log(header)
   console.log(separator)

   for (const row of rows) {
      const line = keys
         .map((k, i) => String(row[k] ?? "").padEnd(widths[i]))
         .join("  ")
      console.log(line)
   }
}

export function printRecord(record: Record<string, unknown>): void {
   const maxKey = Math.max(...Object.keys(record).map((k) => k.length))
   for (const [key, value] of Object.entries(record)) {
      console.log(`${key.padEnd(maxKey)}  ${value}`)
   }
}
```

**Step 2: Commit**

```bash
git add libraries/cli/src/output.ts
git commit -m "feat(cli): add output formatter"
```

---

### Task 7: CLI commands

**Files:**
- Create: `libraries/cli/src/commands/auth.ts`
- Create: `libraries/cli/src/commands/accounts.ts`
- Create: `libraries/cli/src/commands/transactions.ts`
- Create: `libraries/cli/src/commands/categories.ts`
- Create: `libraries/cli/src/commands/budgets.ts`

**Step 1: Write auth commands**

```typescript
import type { CAC } from "cac"
import { saveConfig, clearConfig, getConfig } from "../config"

export function registerAuthCommands(cli: CAC): void {
   cli.command("login", "Authenticate with your Montte API key")
      .option("--key <key>", "API key")
      .option("--host <host>", "API host (default: https://api.montte.com)")
      .action((options: { key?: string; host?: string }) => {
         if (!options.key) {
            console.error("Usage: montte login --key <your-api-key>")
            process.exit(1)
         }
         saveConfig({ apiKey: options.key, host: options.host })
         console.log("Logged in successfully.")
      })

   cli.command("logout", "Remove stored credentials")
      .action(() => {
         clearConfig()
         console.log("Logged out.")
      })

   cli.command("whoami", "Show current authentication status")
      .action(() => {
         const config = getConfig()
         if (!config) {
            console.log("Not logged in.")
            return
         }
         console.log(`API Key: ${config.apiKey.slice(0, 8)}...`)
         if (config.host) console.log(`Host: ${config.host}`)
      })
}
```

**Step 2: Write accounts commands**

```typescript
import type { CAC } from "cac"
import { requireConfig } from "../config"
import { createClient } from "../client"
import { printJson, printTable, printRecord } from "../output"

export function registerAccountsCommands(cli: CAC): void {
   cli.command("accounts list", "List bank accounts")
      .option("--json", "Output as JSON")
      .option("--archived", "Include archived accounts")
      .action(async (options: { json?: boolean; archived?: boolean }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const accounts = await client.accounts.list({
            includeArchived: options.archived,
         })
         if (options.json) return printJson(accounts)
         printTable(
            accounts.map((a) => ({
               id: a.id,
               name: a.name,
               type: a.type,
               status: a.status,
               balance: a.currentBalance,
            })),
         )
      })

   cli.command("accounts get <id>", "Get bank account details")
      .option("--json", "Output as JSON")
      .action(async (id: string, options: { json?: boolean }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const account = await client.accounts.get({ id })
         if (options.json) return printJson(account)
         printRecord(account)
      })

   cli.command("accounts create", "Create a bank account")
      .option("--name <name>", "Account name", { required: true })
      .option("--type <type>", "Account type (checking, savings, investment, payment, cash)")
      .option("--balance <balance>", "Initial balance")
      .option("--json", "Output as JSON")
      .action(async (options: { name: string; type?: string; balance?: string; json?: boolean }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const account = await client.accounts.create({
            name: options.name,
            type: (options.type as any) ?? "checking",
            initialBalance: options.balance ?? "0",
         })
         if (options.json) return printJson(account)
         console.log(`Created account: ${account.name} (${account.id})`)
      })
}
```

**Step 3: Write transactions commands**

```typescript
import type { CAC } from "cac"
import { requireConfig } from "../config"
import { createClient } from "../client"
import { printJson, printTable, printRecord } from "../output"

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
      .action(async (options: {
         json?: boolean
         type?: string
         from?: string
         to?: string
         account?: string
         category?: string
         search?: string
         page?: number
         limit?: number
      }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const result = await client.transactions.list({
            type: options.type as any,
            dateFrom: options.from,
            dateTo: options.to,
            bankAccountId: options.account,
            categoryId: options.category,
            search: options.search,
            page: Number(options.page),
            pageSize: Number(options.limit),
         })
         if (options.json) return printJson(result)
         console.log(`Total: ${result.total}`)
         printTable(
            result.data.map((t) => ({
               id: t.id,
               date: t.date,
               type: t.type,
               name: t.name ?? "-",
               amount: t.amount,
               category: t.categoryId ?? "-",
            })),
         )
      })

   cli.command("transactions get <id>", "Get transaction details")
      .option("--json", "Output as JSON")
      .action(async (id: string, options: { json?: boolean }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const tx = await client.transactions.get({ id })
         if (options.json) return printJson(tx)
         printRecord(tx)
      })

   cli.command("transactions create", "Create a transaction")
      .option("--type <type>", "Type (income, expense, transfer)", { required: true })
      .option("--amount <amount>", "Amount", { required: true })
      .option("--date <date>", "Date (YYYY-MM-DD)", { required: true })
      .option("--name <name>", "Name/description")
      .option("--account <id>", "Bank account ID")
      .option("--category <id>", "Category ID")
      .option("--json", "Output as JSON")
      .action(async (options: {
         type: string
         amount: string
         date: string
         name?: string
         account?: string
         category?: string
         json?: boolean
      }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const tx = await client.transactions.create({
            type: options.type as any,
            amount: options.amount,
            date: options.date,
            name: options.name,
            bankAccountId: options.account,
            categoryId: options.category,
         })
         if (options.json) return printJson(tx)
         console.log(`Created transaction: ${tx.name ?? tx.id} (${tx.amount})`)
      })

   cli.command("transactions summary", "Get transactions summary")
      .option("--json", "Output as JSON")
      .option("--from <date>", "Start date (YYYY-MM-DD)")
      .option("--to <date>", "End date (YYYY-MM-DD)")
      .option("--type <type>", "Filter by type")
      .action(async (options: {
         json?: boolean
         from?: string
         to?: string
         type?: string
      }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const summary = await client.transactions.summary({
            dateFrom: options.from,
            dateTo: options.to,
            type: options.type as any,
         })
         if (options.json) return printJson(summary)
         printRecord(summary)
      })

   cli.command("transactions remove <id>", "Delete a transaction")
      .action(async (id: string) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         await client.transactions.remove({ id })
         console.log("Transaction deleted.")
      })
}
```

**Step 4: Write categories commands**

```typescript
import type { CAC } from "cac"
import { requireConfig } from "../config"
import { createClient } from "../client"
import { printJson, printTable } from "../output"

export function registerCategoriesCommands(cli: CAC): void {
   cli.command("categories list", "List categories")
      .option("--json", "Output as JSON")
      .option("--type <type>", "Filter by type (income, expense)")
      .option("--archived", "Include archived categories")
      .action(async (options: { json?: boolean; type?: string; archived?: boolean }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const categories = await client.categories.list({
            type: options.type as any,
            includeArchived: options.archived,
         })
         if (options.json) return printJson(categories)
         printTable(
            categories.map((c) => ({
               id: c.id,
               name: c.name,
               type: c.type,
               level: c.level,
               archived: c.isArchived ? "yes" : "no",
            })),
         )
      })

   cli.command("categories create", "Create a category")
      .option("--name <name>", "Category name", { required: true })
      .option("--type <type>", "Type (income, expense)", { required: true })
      .option("--parent <id>", "Parent category ID")
      .option("--color <color>", "Color hex")
      .option("--json", "Output as JSON")
      .action(async (options: {
         name: string
         type: string
         parent?: string
         color?: string
         json?: boolean
      }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const category = await client.categories.create({
            name: options.name,
            type: options.type as any,
            parentId: options.parent,
            color: options.color,
         })
         if (options.json) return printJson(category)
         console.log(`Created category: ${category.name} (${category.id})`)
      })

   cli.command("categories remove <id>", "Delete a category")
      .action(async (id: string) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         await client.categories.remove({ id })
         console.log("Category deleted.")
      })

   cli.command("categories archive <id>", "Archive a category")
      .option("--json", "Output as JSON")
      .action(async (id: string, options: { json?: boolean }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const category = await client.categories.archive({ id })
         if (options.json) return printJson(category)
         console.log(`Archived: ${category.name}`)
      })
}
```

**Step 5: Write budgets commands**

```typescript
import type { CAC } from "cac"
import { requireConfig } from "../config"
import { createClient } from "../client"
import { printJson, printTable, printRecord } from "../output"

export function registerBudgetsCommands(cli: CAC): void {
   cli.command("budgets list", "List budget goals for a month")
      .option("--month <n>", "Month (1-12)", { required: true })
      .option("--year <n>", "Year", { required: true })
      .option("--json", "Output as JSON")
      .action(async (options: { month: number; year: number; json?: boolean }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const goals = await client.budgets.list({
            month: Number(options.month),
            year: Number(options.year),
         })
         if (options.json) return printJson(goals)
         printTable(
            goals.map((g) => ({
               id: g.id,
               category: g.categoryId,
               limit: g.limitAmount,
               spent: g.currentSpent,
               percent: `${g.percentUsed}%`,
            })),
         )
      })

   cli.command("budgets get <id>", "Get budget goal details")
      .option("--json", "Output as JSON")
      .action(async (id: string, options: { json?: boolean }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const goal = await client.budgets.get({ id })
         if (options.json) return printJson(goal)
         printRecord(goal)
      })

   cli.command("budgets create", "Create a budget goal")
      .option("--category <id>", "Category ID", { required: true })
      .option("--month <n>", "Month (1-12)", { required: true })
      .option("--year <n>", "Year", { required: true })
      .option("--limit <amount>", "Limit amount", { required: true })
      .option("--alert <n>", "Alert threshold percentage (1-100)")
      .option("--json", "Output as JSON")
      .action(async (options: {
         category: string
         month: number
         year: number
         limit: string
         alert?: number
         json?: boolean
      }) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         const goal = await client.budgets.create({
            categoryId: options.category,
            month: Number(options.month),
            year: Number(options.year),
            limitAmount: options.limit,
            alertThreshold: options.alert ? Number(options.alert) : undefined,
         })
         if (options.json) return printJson(goal)
         console.log(`Created budget goal: ${goal.id}`)
      })

   cli.command("budgets remove <id>", "Delete a budget goal")
      .action(async (id: string) => {
         const config = requireConfig()
         const client = createClient(config.apiKey, config.host)
         await client.budgets.remove({ id })
         console.log("Budget goal deleted.")
      })
}
```

**Step 6: Commit**

```bash
git add libraries/cli/src/commands/
git commit -m "feat(cli): add all CLI commands"
```

---

### Task 8: CLI entry point

**Files:**
- Create: `libraries/cli/src/index.ts`

**Step 1: Write entry point**

```typescript
#!/usr/bin/env bun
import cac from "cac"
import { registerAuthCommands } from "./commands/auth"
import { registerAccountsCommands } from "./commands/accounts"
import { registerTransactionsCommands } from "./commands/transactions"
import { registerCategoriesCommands } from "./commands/categories"
import { registerBudgetsCommands } from "./commands/budgets"

const cli = cac("montte")

registerAuthCommands(cli)
registerAccountsCommands(cli)
registerTransactionsCommands(cli)
registerCategoriesCommands(cli)
registerBudgetsCommands(cli)

cli.help()
cli.version("0.1.0")

cli.parse()
```

**Step 2: Commit**

```bash
git add libraries/cli/src/index.ts
git commit -m "feat(cli): add entry point"
```

---

### Task 9: Server — implement contract

**Files:**
- Modify: `apps/server/package.json` — add `@montte/cli` dependency
- Modify: `apps/server/tsconfig.json` — add `@montte/cli/*` path
- Modify: `apps/server/src/orpc/router/index.ts` — add new routers
- Create: `apps/server/src/orpc/router/accounts.ts`
- Create: `apps/server/src/orpc/router/transactions.ts`
- Create: `apps/server/src/orpc/router/categories.ts`
- Create: `apps/server/src/orpc/router/budgets.ts`

**Step 1: Add CLI dependency to server**

In `apps/server/package.json`, add to `dependencies`:
```json
"@montte/cli": "workspace:*"
```

**Step 2: Add path alias to server tsconfig**

In `apps/server/tsconfig.json`, add to `compilerOptions.paths`:
```json
"@montte/cli/*": ["../../libraries/cli/src/*"]
```

**Step 3: Write accounts router**

```typescript
import { implement } from "@orpc/server"
import { contract } from "@montte/cli/contract"
import { sdkProcedure } from "../server"
import {
   listBankAccountsWithBalance,
   getBankAccount,
   createBankAccount,
   updateBankAccount,
   deleteBankAccount,
   computeBankAccountBalance,
   ensureBankAccountOwnership,
} from "@core/database/repositories/bank-accounts-repository"

const os = implement(contract)

export const list = os.accounts.list
   .use(sdkProcedure)
   .handler(async ({ context, input }) => {
      const accounts = await listBankAccountsWithBalance(
         context.teamId!,
         input.includeArchived,
      )
      return accounts.map((a) => ({
         ...a,
         initialBalance: a.initialBalance ?? "0",
         initialBalanceDate: a.initialBalanceDate
            ? String(a.initialBalanceDate)
            : null,
         createdAt: a.createdAt.toISOString(),
         updatedAt: a.updatedAt.toISOString(),
      }))
   })

export const get = os.accounts.get
   .use(sdkProcedure)
   .handler(async ({ context, input }) => {
      const account = await ensureBankAccountOwnership(input.id, context.teamId!)
      const balance = await computeBankAccountBalance(
         account.id,
         account.initialBalance ?? "0",
      )
      return {
         ...account,
         initialBalance: account.initialBalance ?? "0",
         initialBalanceDate: account.initialBalanceDate
            ? String(account.initialBalanceDate)
            : null,
         currentBalance: balance.currentBalance,
         projectedBalance: balance.projectedBalance,
         createdAt: account.createdAt.toISOString(),
         updatedAt: account.updatedAt.toISOString(),
      }
   })

export const create = os.accounts.create
   .use(sdkProcedure)
   .handler(async ({ context, input }) => {
      const account = await createBankAccount(context.teamId!, input)
      const balance = await computeBankAccountBalance(
         account.id,
         account.initialBalance ?? "0",
      )
      return {
         ...account,
         initialBalance: account.initialBalance ?? "0",
         initialBalanceDate: account.initialBalanceDate
            ? String(account.initialBalanceDate)
            : null,
         currentBalance: balance.currentBalance,
         projectedBalance: balance.projectedBalance,
         createdAt: account.createdAt.toISOString(),
         updatedAt: account.updatedAt.toISOString(),
      }
   })

export const update = os.accounts.update
   .use(sdkProcedure)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input
      await ensureBankAccountOwnership(id, context.teamId!)
      const account = await updateBankAccount(id, data)
      const balance = await computeBankAccountBalance(
         account.id,
         account.initialBalance ?? "0",
      )
      return {
         ...account,
         initialBalance: account.initialBalance ?? "0",
         initialBalanceDate: account.initialBalanceDate
            ? String(account.initialBalanceDate)
            : null,
         currentBalance: balance.currentBalance,
         projectedBalance: balance.projectedBalance,
         createdAt: account.createdAt.toISOString(),
         updatedAt: account.updatedAt.toISOString(),
      }
   })

export const remove = os.accounts.remove
   .use(sdkProcedure)
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(input.id, context.teamId!)
      await deleteBankAccount(input.id)
      return { success: true as const }
   })
```

**Step 4: Write transactions router**

The transactions router follows the same pattern — import from `@core/database/repositories/transactions-repository`, map DB types to contract output types (dates to ISO strings, etc.).

Key points:
- `list` calls `listTransactions(filter)` and maps results
- `get` calls `ensureTransactionOwnership` + `getTransactionWithTags`
- `create` calls `validateTransactionReferences` then `createTransaction`
- `update` calls `ensureTransactionOwnership` + `updateTransaction`
- `remove` calls `ensureTransactionOwnership` + `deleteTransaction`
- `summary` calls `getTransactionsSummary`

**Step 5: Write categories router**

Same pattern — import from `@core/database/repositories/categories-repository`.

**Step 6: Write budgets router**

Same pattern — import from `@core/database/repositories/budget-goals-repository`.

**Step 7: Update router index**

```typescript
import * as events from "./events"
import * as accounts from "./accounts"
import * as transactions from "./transactions"
import * as categories from "./categories"
import * as budgets from "./budgets"

export default {
   events,
   accounts,
   transactions,
   categories,
   budgets,
}
```

**Step 8: Run typecheck**

```bash
bun run typecheck
```

**Step 9: Commit**

```bash
git add apps/server/
git commit -m "feat(server): implement contract-first routers for CLI"
```

---

### Task 10: Tests — contract schemas

**Files:**
- Create: `libraries/cli/__tests__/contract/schemas.test.ts`

**Step 1: Write schema validation tests**

```typescript
import { describe, expect, it } from "vitest"
import {
   BankAccountSchema,
   CreateBankAccountSchema,
   TransactionSchema,
   CreateTransactionSchema,
   ListTransactionsFilterSchema,
   TransactionSummarySchema,
   CategorySchema,
   CreateCategorySchema,
   BudgetGoalSchema,
   CreateBudgetGoalSchema,
} from "../../src/contract/schemas"

describe("BankAccountSchema", () => {
   it("parses a valid bank account", () => {
      const result = BankAccountSchema.safeParse({
         id: "550e8400-e29b-41d4-a716-446655440000",
         name: "Nubank",
         type: "checking",
         status: "active",
         color: "#6366f1",
         iconUrl: null,
         bankCode: "260",
         bankName: "Nu Pagamentos",
         branch: null,
         accountNumber: null,
         initialBalance: "1000.00",
         initialBalanceDate: "2026-01-01",
         notes: null,
         currentBalance: "1500.00",
         projectedBalance: "1500.00",
         createdAt: "2026-01-01T00:00:00.000Z",
         updatedAt: "2026-01-01T00:00:00.000Z",
      })
      expect(result.success).toBe(true)
   })

   it("rejects invalid type", () => {
      const result = BankAccountSchema.safeParse({
         id: "550e8400-e29b-41d4-a716-446655440000",
         name: "Test",
         type: "invalid",
         status: "active",
         color: "#000",
         iconUrl: null,
         bankCode: null,
         bankName: null,
         branch: null,
         accountNumber: null,
         initialBalance: "0",
         initialBalanceDate: null,
         notes: null,
         currentBalance: "0",
         projectedBalance: "0",
         createdAt: "2026-01-01T00:00:00.000Z",
         updatedAt: "2026-01-01T00:00:00.000Z",
      })
      expect(result.success).toBe(false)
   })
})

describe("CreateBankAccountSchema", () => {
   it("parses with defaults", () => {
      const result = CreateBankAccountSchema.safeParse({ name: "Nubank" })
      expect(result.success).toBe(true)
      if (result.success) {
         expect(result.data.type).toBe("checking")
         expect(result.data.color).toBe("#6366f1")
         expect(result.data.initialBalance).toBe("0")
      }
   })

   it("rejects empty name", () => {
      const result = CreateBankAccountSchema.safeParse({ name: "" })
      expect(result.success).toBe(false)
   })
})

describe("TransactionSchema", () => {
   it("parses a valid transaction", () => {
      const result = TransactionSchema.safeParse({
         id: "550e8400-e29b-41d4-a716-446655440000",
         name: "Aluguel",
         type: "expense",
         amount: "2500.00",
         description: null,
         date: "2026-03-01",
         bankAccountId: "550e8400-e29b-41d4-a716-446655440001",
         destinationBankAccountId: null,
         creditCardId: null,
         categoryId: null,
         contactId: null,
         paymentMethod: "pix",
         attachmentUrl: null,
         createdAt: "2026-03-01T00:00:00.000Z",
         updatedAt: "2026-03-01T00:00:00.000Z",
      })
      expect(result.success).toBe(true)
   })
})

describe("CreateTransactionSchema", () => {
   it("parses minimal valid input", () => {
      const result = CreateTransactionSchema.safeParse({
         type: "income",
         amount: "100.00",
         date: "2026-03-01",
      })
      expect(result.success).toBe(true)
   })

   it("rejects invalid amount", () => {
      const result = CreateTransactionSchema.safeParse({
         type: "income",
         amount: "abc",
         date: "2026-03-01",
      })
      expect(result.success).toBe(false)
   })

   it("rejects invalid date format", () => {
      const result = CreateTransactionSchema.safeParse({
         type: "income",
         amount: "100.00",
         date: "03/01/2026",
      })
      expect(result.success).toBe(false)
   })
})

describe("ListTransactionsFilterSchema", () => {
   it("parses with defaults", () => {
      const result = ListTransactionsFilterSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
         expect(result.data.page).toBe(1)
         expect(result.data.pageSize).toBe(25)
      }
   })

   it("rejects page size over 100", () => {
      const result = ListTransactionsFilterSchema.safeParse({ pageSize: 200 })
      expect(result.success).toBe(false)
   })
})

describe("TransactionSummarySchema", () => {
   it("parses valid summary", () => {
      const result = TransactionSummarySchema.safeParse({
         totalCount: 42,
         incomeTotal: "5000.00",
         expenseTotal: "3200.00",
         balance: "1800.00",
      })
      expect(result.success).toBe(true)
   })
})

describe("CategorySchema", () => {
   it("parses valid category", () => {
      const result = CategorySchema.safeParse({
         id: "550e8400-e29b-41d4-a716-446655440000",
         parentId: null,
         name: "Alimentação",
         type: "expense",
         level: 1,
         description: null,
         isDefault: false,
         color: "#ef4444",
         icon: null,
         isArchived: false,
         keywords: ["comida", "restaurante"],
         notes: null,
         createdAt: "2026-01-01T00:00:00.000Z",
         updatedAt: "2026-01-01T00:00:00.000Z",
      })
      expect(result.success).toBe(true)
   })
})

describe("CreateCategorySchema", () => {
   it("parses minimal input", () => {
      const result = CreateCategorySchema.safeParse({
         name: "Moradia",
         type: "expense",
      })
      expect(result.success).toBe(true)
   })

   it("rejects invalid type", () => {
      const result = CreateCategorySchema.safeParse({
         name: "Test",
         type: "both",
      })
      expect(result.success).toBe(false)
   })
})

describe("BudgetGoalSchema", () => {
   it("parses valid budget goal", () => {
      const result = BudgetGoalSchema.safeParse({
         id: "550e8400-e29b-41d4-a716-446655440000",
         categoryId: "550e8400-e29b-41d4-a716-446655440001",
         month: 3,
         year: 2026,
         limitAmount: "5000.00",
         alertThreshold: 80,
         currentSpent: "3500.00",
         percentUsed: 70,
         createdAt: "2026-01-01T00:00:00.000Z",
         updatedAt: "2026-01-01T00:00:00.000Z",
      })
      expect(result.success).toBe(true)
   })
})

describe("CreateBudgetGoalSchema", () => {
   it("parses valid input", () => {
      const result = CreateBudgetGoalSchema.safeParse({
         categoryId: "550e8400-e29b-41d4-a716-446655440000",
         month: 3,
         year: 2026,
         limitAmount: "5000.00",
      })
      expect(result.success).toBe(true)
   })

   it("rejects month out of range", () => {
      const result = CreateBudgetGoalSchema.safeParse({
         categoryId: "550e8400-e29b-41d4-a716-446655440000",
         month: 13,
         year: 2026,
         limitAmount: "5000.00",
      })
      expect(result.success).toBe(false)
   })

   it("rejects alert threshold over 100", () => {
      const result = CreateBudgetGoalSchema.safeParse({
         categoryId: "550e8400-e29b-41d4-a716-446655440000",
         month: 3,
         year: 2026,
         limitAmount: "5000.00",
         alertThreshold: 150,
      })
      expect(result.success).toBe(false)
   })
})
```

**Step 2: Run tests**

```bash
npx vitest run libraries/cli/__tests__/contract/schemas.test.ts
```

Expected: all pass

**Step 3: Commit**

```bash
git add libraries/cli/__tests__/
git commit -m "test(cli): add contract schema validation tests"
```

---

### Task 11: Tests — config module

**Files:**
- Create: `libraries/cli/__tests__/config.test.ts`

**Step 1: Write config tests**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest"
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

vi.mock("node:os", async () => {
   const actual = await vi.importActual<typeof import("node:os")>("node:os")
   const testHome = join(actual.tmpdir(), `montte-test-${Date.now()}`)
   return { ...actual, homedir: () => testHome }
})

import { getConfig, saveConfig, clearConfig, requireConfig } from "../src/config"
import { homedir } from "node:os"

const CONFIG_DIR = join(homedir(), ".montte")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

afterEach(() => {
   if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE)
   if (existsSync(CONFIG_DIR)) {
      try { unlinkSync(CONFIG_DIR) } catch { /* dir */ }
   }
   delete process.env.MONTTE_API_KEY
   delete process.env.MONTTE_HOST
})

describe("getConfig", () => {
   it("returns null when no config exists", () => {
      expect(getConfig()).toBeNull()
   })

   it("reads from env vars", () => {
      process.env.MONTTE_API_KEY = "env-key"
      process.env.MONTTE_HOST = "http://localhost:9877"
      const config = getConfig()
      expect(config).toEqual({
         apiKey: "env-key",
         host: "http://localhost:9877",
      })
   })

   it("reads from config file", () => {
      mkdirSync(CONFIG_DIR, { recursive: true })
      writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey: "file-key" }))
      const config = getConfig()
      expect(config).toEqual({ apiKey: "file-key" })
   })

   it("env vars take precedence over file", () => {
      mkdirSync(CONFIG_DIR, { recursive: true })
      writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey: "file-key" }))
      process.env.MONTTE_API_KEY = "env-key"
      expect(getConfig()?.apiKey).toBe("env-key")
   })
})

describe("saveConfig", () => {
   it("creates config dir and file", () => {
      saveConfig({ apiKey: "test-key" })
      expect(existsSync(CONFIG_FILE)).toBe(true)
      const content = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"))
      expect(content.apiKey).toBe("test-key")
   })
})

describe("clearConfig", () => {
   it("removes config file", () => {
      saveConfig({ apiKey: "test-key" })
      clearConfig()
      expect(existsSync(CONFIG_FILE)).toBe(false)
   })

   it("does nothing when no config exists", () => {
      expect(() => clearConfig()).not.toThrow()
   })
})

describe("requireConfig", () => {
   it("returns config when it exists", () => {
      saveConfig({ apiKey: "test-key" })
      expect(requireConfig().apiKey).toBe("test-key")
   })

   it("exits when no config", () => {
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
         throw new Error("process.exit")
      })
      expect(() => requireConfig()).toThrow("process.exit")
      mockExit.mockRestore()
   })
})
```

**Step 2: Run tests**

```bash
npx vitest run libraries/cli/__tests__/config.test.ts
```

Expected: all pass

**Step 3: Commit**

```bash
git add libraries/cli/__tests__/config.test.ts
git commit -m "test(cli): add config module tests"
```

---

### Task 12: Tests — output formatter

**Files:**
- Create: `libraries/cli/__tests__/output.test.ts`

**Step 1: Write output tests**

```typescript
import { describe, expect, it, vi } from "vitest"
import { printJson, printTable, printRecord } from "../src/output"

describe("printJson", () => {
   it("outputs formatted JSON", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {})
      printJson({ id: "1", name: "Test" })
      expect(spy).toHaveBeenCalledWith(
         JSON.stringify({ id: "1", name: "Test" }, null, 2),
      )
      spy.mockRestore()
   })
})

describe("printTable", () => {
   it("prints header, separator, and rows", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {})
      printTable([
         { id: "1", name: "Nubank" },
         { id: "2", name: "Itaú" },
      ])
      expect(spy).toHaveBeenCalledTimes(4) // header + separator + 2 rows
      spy.mockRestore()
   })

   it("prints message for empty array", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {})
      printTable([])
      expect(spy).toHaveBeenCalledWith("No results.")
      spy.mockRestore()
   })

   it("respects custom columns", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {})
      printTable(
         [{ id: "1", name: "Nubank", extra: "ignored" }],
         ["id", "name"],
      )
      const headerCall = spy.mock.calls[0][0] as string
      expect(headerCall).not.toContain("extra")
      spy.mockRestore()
   })
})

describe("printRecord", () => {
   it("prints key-value pairs", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {})
      printRecord({ name: "Nubank", balance: "1000.00" })
      expect(spy).toHaveBeenCalledTimes(2)
      spy.mockRestore()
   })
})
```

**Step 2: Run tests**

```bash
npx vitest run libraries/cli/__tests__/output.test.ts
```

Expected: all pass

**Step 3: Commit**

```bash
git add libraries/cli/__tests__/output.test.ts
git commit -m "test(cli): add output formatter tests"
```

---

### Task 13: Tests — contract router structure

**Files:**
- Create: `libraries/cli/__tests__/contract/router.test.ts`

**Step 1: Write contract structure tests**

```typescript
import { describe, expect, it } from "vitest"
import { contract } from "../../src/contract"

describe("contract structure", () => {
   it("has accounts namespace with all procedures", () => {
      expect(contract.accounts).toBeDefined()
      expect(contract.accounts.list).toBeDefined()
      expect(contract.accounts.get).toBeDefined()
      expect(contract.accounts.create).toBeDefined()
      expect(contract.accounts.update).toBeDefined()
      expect(contract.accounts.remove).toBeDefined()
   })

   it("has transactions namespace with all procedures", () => {
      expect(contract.transactions).toBeDefined()
      expect(contract.transactions.list).toBeDefined()
      expect(contract.transactions.get).toBeDefined()
      expect(contract.transactions.create).toBeDefined()
      expect(contract.transactions.update).toBeDefined()
      expect(contract.transactions.remove).toBeDefined()
      expect(contract.transactions.summary).toBeDefined()
   })

   it("has categories namespace with all procedures", () => {
      expect(contract.categories).toBeDefined()
      expect(contract.categories.list).toBeDefined()
      expect(contract.categories.create).toBeDefined()
      expect(contract.categories.update).toBeDefined()
      expect(contract.categories.remove).toBeDefined()
      expect(contract.categories.archive).toBeDefined()
   })

   it("has budgets namespace with all procedures", () => {
      expect(contract.budgets).toBeDefined()
      expect(contract.budgets.list).toBeDefined()
      expect(contract.budgets.get).toBeDefined()
      expect(contract.budgets.create).toBeDefined()
      expect(contract.budgets.update).toBeDefined()
      expect(contract.budgets.remove).toBeDefined()
   })
})
```

**Step 2: Run tests**

```bash
npx vitest run libraries/cli/__tests__/contract/router.test.ts
```

Expected: all pass

**Step 3: Commit**

```bash
git add libraries/cli/__tests__/contract/router.test.ts
git commit -m "test(cli): add contract router structure tests"
```

---

### Task 14: Verify CLI works end-to-end

**Step 1: Test CLI help**

```bash
bun libraries/cli/src/index.ts --help
```

Expected: shows all commands (login, accounts, transactions, categories, budgets)

**Step 2: Test login**

```bash
bun libraries/cli/src/index.ts login --key test-key-123
cat ~/.montte/config.json
```

**Step 3: Test whoami**

```bash
bun libraries/cli/src/index.ts whoami
```

Expected: shows `API Key: test-key...`

**Step 4: Clean up and commit**

```bash
bun libraries/cli/src/index.ts logout
git add -A
git commit -m "chore: verify CLI end-to-end"
```

---

### Task 15: Add @orpc/contract to root catalog

**Files:**
- Modify: `package.json` — add `@orpc/contract` to orpc catalog if missing

**Step 1: Check if @orpc/contract is in catalog**

Look at root `package.json` catalogs.orpc — if `@orpc/contract` is missing, add it with the same version as other orpc packages.

**Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @orpc/contract to workspace catalog"
```
