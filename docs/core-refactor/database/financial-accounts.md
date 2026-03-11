# Conta Financeira — Core Database Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure `bank-accounts` at the core/database level — add status/archiving, Zod validators with business rules, repository with `@f-o-t/money` for balance computation, and tests.

**Architecture:** Minimal schema change (add `status` enum, fix `initialBalanceDate` type). Zod validators derived from `createInsertSchema` enforce business rules (cash vs bank-type conditional fields). Repository validates input via Zod and uses `@f-o-t/money` for precise balance math. Tests cover validators and repository.

**Tech Stack:** Drizzle ORM v1 beta, drizzle-orm/zod, Zod 4, `@f-o-t/money`, Vitest

**Scope:** Core level ONLY — `core/database/` + `core/utils/`. No router, no frontend, no packages.

---

## Context for the Implementer

### Current State

- Schema: `core/database/src/schemas/bank-accounts.ts` — basic fields, no status/archiving
- Repository: `core/database/src/repositories/bank-accounts-repository.ts` — raw CRUD, no validation, raw `Number()` arithmetic for balances
- Tests: **none** for bank accounts

### Schema Changes Summary

| Change                                                 | Why                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| Add `status` enum (`active`/`archived`)                | Accounts with transactions can't be deleted, only archived |
| Change `initialBalanceDate` from `timestamp` to `date` | It's a calendar date, not a moment                         |
| Remove `nickname`                                      | Redundant with `name` (spec calls `name` "apelido")        |

**Deliberately NOT adding:**

- `currency` — only BRL for now, add when multi-currency is needed
- `source` / `origem_dados` — transactions have sources, not accounts
- `createdBy` / `updatedBy` — will be handled by a centralized audit module ([#638](https://github.com/F-O-T/montte-nx/issues/638))

### `@f-o-t/money` Key APIs

```typescript
import { of, add, subtract, toDecimal } from "@f-o-t/money";

// Create: of("1000.50", "BRL") → Money
// Arithmetic: add(a, b), subtract(a, b) — exact BigInt math, no floating point
// To string: toDecimal(money) → "1000.50"
```

### Key Files Reference

- Error utils: `core/utils/src/errors.ts` — `AppError`, `propagateError`, `validateInput` (needs type fix for ZodEffects)
- Schema exports: `core/database/src/schema.ts` — re-exports all schemas
- Relations: `core/database/src/relations.ts` — bankAccounts relations already defined
- Test helpers: `apps/web/__tests__/helpers/mock-factories.ts` — factory pattern
- Test context: `apps/web/__tests__/helpers/create-test-context.ts` — `TEST_USER_ID`, `TEST_TEAM_ID`

### Business Rules (from spec)

1. **Cash accounts (`cash`)**: `bankCode`, `bankName`, `branch`, `accountNumber` MUST be null
2. **Bank-type accounts (`checking`, `savings`, `investment`, `payment`)**: `bankCode` is required
3. **Initial balance**: can be positive OR negative
4. **Archiving**: accounts with transactions cannot be deleted, only archived
5. **Archived accounts**: hidden from lists by default, can be reactivated

---

## Task 1: Update bank accounts schema

**Files:**

- Modify: `core/database/src/schemas/bank-accounts.ts`

**Step 1: Replace file content**

```typescript
import { sql } from "drizzle-orm";
import {
   date,
   index,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";

export const bankAccountTypeEnum = pgEnum("bank_account_type", [
   "checking",
   "savings",
   "investment",
   "payment",
   "cash",
]);

export const bankAccountStatusEnum = pgEnum("bank_account_status", [
   "active",
   "archived",
]);

export const bankAccounts = pgTable(
   "bank_accounts",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: bankAccountTypeEnum("type").notNull().default("checking"),
      status: bankAccountStatusEnum("status").notNull().default("active"),
      color: text("color").notNull().default("#6366f1"),
      iconUrl: text("icon_url"),
      bankCode: text("bank_code"),
      bankName: text("bank_name"),
      branch: text("branch"),
      accountNumber: text("account_number"),
      initialBalance: numeric("initial_balance", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      initialBalanceDate: date("initial_balance_date"),
      notes: text("notes"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("bank_accounts_team_id_idx").on(table.teamId),
      index("bank_accounts_status_idx").on(table.status),
   ],
);

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type BankAccountType = (typeof bankAccountTypeEnum.enumValues)[number];
export type BankAccountStatus =
   (typeof bankAccountStatusEnum.enumValues)[number];
```

**Changes:**

- Added `status` enum + column (default `active`)
- Added `status` index
- Changed `initialBalanceDate` from `timestamp` to `date`
- Removed `nickname` field
- Exported `BankAccountStatus` type

**Step 2: Push schema**

Run: `cd core/database && bun run push`

**Step 3: Commit**

```bash
git add core/database/src/schemas/bank-accounts.ts
git commit -m "feat(database): add status enum and fix initialBalanceDate type in bank accounts"
```

---

## Task 2: Create Zod validation schemas

**Files:**

- Create: `core/database/src/schemas/bank-accounts.validators.ts`
- Modify: `core/database/src/schema.ts` (add export)

**Step 1: Create the validators file**

```typescript
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { bankAccounts } from "./bank-accounts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANK_TYPES = ["checking", "savings", "investment", "payment"] as const;

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// Base schema from Drizzle — user-provided fields only
// ---------------------------------------------------------------------------

const baseBankAccountSchema = createInsertSchema(bankAccounts).pick({
   name: true,
   type: true,
   color: true,
   iconUrl: true,
   bankCode: true,
   bankName: true,
   branch: true,
   accountNumber: true,
   initialBalance: true,
   initialBalanceDate: true,
   notes: true,
});

// ---------------------------------------------------------------------------
// Create schema
// ---------------------------------------------------------------------------

export const createBankAccountSchema = baseBankAccountSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(80, "Nome deve ter no máximo 80 caracteres."),
      color: z
         .string()
         .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).")
         .default("#6366f1"),
      initialBalance: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)), {
            message: "Saldo inicial deve ser um número válido.",
         })
         .default("0"),
      initialBalanceDate: z.coerce.date().optional().nullable(),
      bankCode: z.string().max(10).optional().nullable(),
      bankName: z.string().max(120).optional().nullable(),
      branch: z.string().max(20).optional().nullable(),
      accountNumber: z.string().max(30).optional().nullable(),
   })
   .superRefine((data, ctx) => {
      const isCash = data.type === "cash";
      const isBankType = BANK_TYPES.includes(
         data.type as (typeof BANK_TYPES)[number],
      );

      if (isCash) {
         if (data.bankCode) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["bankCode"],
               message: "Caixa físico não deve ter código do banco.",
            });
         }
         if (data.branch) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["branch"],
               message: "Caixa físico não deve ter agência.",
            });
         }
         if (data.accountNumber) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["accountNumber"],
               message: "Caixa físico não deve ter número da conta.",
            });
         }
      }

      if (isBankType && !data.bankCode) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bankCode"],
            message: "Código do banco é obrigatório para contas bancárias.",
         });
      }
   });

// ---------------------------------------------------------------------------
// Update schema — all fields optional
// ---------------------------------------------------------------------------

export const updateBankAccountSchema = baseBankAccountSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(80, "Nome deve ter no máximo 80 caracteres.")
         .optional(),
      color: z
         .string()
         .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).")
         .optional(),
      initialBalance: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)), {
            message: "Saldo inicial deve ser um número válido.",
         })
         .optional(),
      initialBalanceDate: z.coerce.date().optional().nullable(),
      bankCode: z.string().max(10).optional().nullable(),
      bankName: z.string().max(120).optional().nullable(),
      branch: z.string().max(20).optional().nullable(),
      accountNumber: z.string().max(30).optional().nullable(),
   })
   .partial();

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
```

**Step 2: Add export to schema.ts**

In `core/database/src/schema.ts`, add:

```typescript
export * from "./schemas/bank-accounts.validators";
```

**Step 3: Commit**

```bash
git add core/database/src/schemas/bank-accounts.validators.ts core/database/src/schema.ts
git commit -m "feat(database): add Zod validators for bank accounts"
```

---

## Task 3: Fix `validateInput` to accept ZodEffects

**Files:**

- Modify: `core/utils/src/errors.ts`

**Step 1: Update the type constraint**

The `createBankAccountSchema` uses `.superRefine()` which returns `ZodEffects`, not `ZodObject`. Update:

```typescript
// Change import — remove ZodObject:
// FROM:
import type { ZodObject } from "zod";
import { ZodError, type z } from "zod";

// TO:
import { ZodError, type z } from "zod";

// Change function signature:
// FROM:
export function validateInput<T extends ZodObject>(

// TO:
export function validateInput<T extends z.ZodTypeAny>(
```

**Step 2: Commit**

```bash
git add core/utils/src/errors.ts
git commit -m "fix(utils): accept ZodEffects in validateInput"
```

---

## Task 4: Rewrite repository with Zod validation and @f-o-t/money

**Files:**

- Modify: `core/database/src/repositories/bank-accounts-repository.ts`
- Possibly modify: `core/database/package.json` (add `@f-o-t/money` dep)

**Step 1: Check if `@f-o-t/money` is already a dependency of core/database**

Read `core/database/package.json`. If not listed, add:

```json
"@f-o-t/money": "catalog:fot"
```

**Step 2: Replace repository file**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { add, of, subtract, toDecimal } from "@f-o-t/money";
import { and, eq, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { type BankAccount, bankAccounts } from "../schemas/bank-accounts";
import {
   type CreateBankAccountInput,
   type UpdateBankAccountInput,
   createBankAccountSchema,
   updateBankAccountSchema,
} from "../schemas/bank-accounts.validators";
import { bills } from "../schemas/bills";
import { transactions } from "../schemas/transactions";

// =============================================================================
// Create
// =============================================================================

export interface CreateBankAccountParams {
   teamId: string;
   data: CreateBankAccountInput;
}

export async function createBankAccount(
   db: DatabaseInstance,
   params: CreateBankAccountParams,
): Promise<BankAccount> {
   const validated = validateInput(createBankAccountSchema, params.data);
   try {
      const [account] = await db
         .insert(bankAccounts)
         .values({ ...validated, teamId: params.teamId })
         .returning();
      if (!account) throw AppError.database("Failed to create bank account");
      return account;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bank account");
   }
}

// =============================================================================
// Read
// =============================================================================

export interface ListBankAccountsOptions {
   teamId: string;
   includeArchived?: boolean;
}

export async function listBankAccounts(
   db: DatabaseInstance,
   options: ListBankAccountsOptions,
): Promise<BankAccount[]> {
   try {
      const conditions = [eq(bankAccounts.teamId, options.teamId)];
      if (!options.includeArchived) {
         conditions.push(eq(bankAccounts.status, "active"));
      }
      return await db
         .select()
         .from(bankAccounts)
         .where(and(...conditions))
         .orderBy(bankAccounts.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bank accounts");
   }
}

export async function getBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<BankAccount | null> {
   try {
      const [account] = await db
         .select()
         .from(bankAccounts)
         .where(eq(bankAccounts.id, id));
      return account ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get bank account");
   }
}

// =============================================================================
// Update
// =============================================================================

export interface UpdateBankAccountParams {
   id: string;
   data: UpdateBankAccountInput;
}

export async function updateBankAccount(
   db: DatabaseInstance,
   params: UpdateBankAccountParams,
): Promise<BankAccount> {
   const validated = validateInput(updateBankAccountSchema, params.data);
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(bankAccounts.id, params.id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update bank account");
   }
}

// =============================================================================
// Archive / Reactivate
// =============================================================================

export async function archiveBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<BankAccount> {
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({ status: "archived", updatedAt: new Date() })
         .where(eq(bankAccounts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive bank account");
   }
}

export async function reactivateBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<BankAccount> {
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({ status: "active", updatedAt: new Date() })
         .where(eq(bankAccounts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate bank account");
   }
}

// =============================================================================
// Delete (only if no transactions)
// =============================================================================

export async function deleteBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<void> {
   try {
      const hasTransactions = await bankAccountHasTransactions(db, id);
      if (hasTransactions) {
         throw AppError.conflict(
            "Conta com lançamentos não pode ser excluída. Use arquivamento.",
         );
      }
      await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete bank account");
   }
}

// =============================================================================
// Balance Computation (using @f-o-t/money)
// =============================================================================

export interface BankAccountWithBalance extends BankAccount {
   currentBalance: string;
   projectedBalance: string;
}

export async function computeBankAccountBalance(
   db: DatabaseInstance,
   accountId: string,
   initialBalance: string,
): Promise<{ currentBalance: string; projectedBalance: string }> {
   try {
      const currency = "BRL";

      // Transaction aggregates
      const [row] = await db
         .select({
            income: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount::numeric ELSE 0 END), 0)`,
            expense: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount::numeric ELSE 0 END), 0)`,
            transferOut: sql<string>`COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount::numeric ELSE 0 END), 0)`,
         })
         .from(transactions)
         .where(eq(transactions.bankAccountId, accountId));

      const [transferInRow] = await db
         .select({
            transferIn: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
         })
         .from(transactions)
         .where(
            and(
               eq(transactions.destinationBankAccountId, accountId),
               eq(transactions.type, "transfer"),
            ),
         );

      // Balance using @f-o-t/money — precise BigInt arithmetic
      let balance = of(initialBalance, currency);
      balance = add(balance, of(row?.income ?? "0", currency));
      balance = subtract(balance, of(row?.expense ?? "0", currency));
      balance = subtract(balance, of(row?.transferOut ?? "0", currency));
      balance = add(balance, of(transferInRow?.transferIn ?? "0", currency));

      // Projected: current + pending receivables - pending payables
      const [billsRow] = await db
         .select({
            pendingReceivable: sql<string>`COALESCE(SUM(CASE WHEN type = 'receivable' AND status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
            pendingPayable: sql<string>`COALESCE(SUM(CASE WHEN type = 'payable' AND status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
         })
         .from(bills)
         .where(eq(bills.bankAccountId, accountId));

      let projected = balance;
      projected = add(
         projected,
         of(billsRow?.pendingReceivable ?? "0", currency),
      );
      projected = subtract(
         projected,
         of(billsRow?.pendingPayable ?? "0", currency),
      );

      return {
         currentBalance: toDecimal(balance),
         projectedBalance: toDecimal(projected),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to compute bank account balance");
   }
}

export async function listBankAccountsWithBalance(
   db: DatabaseInstance,
   options: ListBankAccountsOptions,
): Promise<BankAccountWithBalance[]> {
   try {
      const accounts = await listBankAccounts(db, options);

      return await Promise.all(
         accounts.map(async (account) => {
            const { currentBalance, projectedBalance } =
               await computeBankAccountBalance(
                  db,
                  account.id,
                  account.initialBalance,
               );
            return { ...account, currentBalance, projectedBalance };
         }),
      );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bank accounts with balance");
   }
}

// =============================================================================
// Helpers
// =============================================================================

export async function bankAccountHasTransactions(
   db: DatabaseInstance,
   accountId: string,
): Promise<boolean> {
   try {
      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactions)
         .where(
            or(
               eq(transactions.bankAccountId, accountId),
               eq(transactions.destinationBankAccountId, accountId),
            ),
         );
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check bank account transactions");
   }
}
```

**Key changes from current:**

- `createBankAccount` takes `CreateBankAccountParams`, validates with Zod
- `updateBankAccount` takes `UpdateBankAccountParams`, validates with Zod
- `listBankAccounts` accepts `includeArchived` (defaults to hiding archived)
- `deleteBankAccount` checks for transactions internally
- New `archiveBankAccount` and `reactivateBankAccount`
- Balance computation uses `@f-o-t/money` (`of()`, `add()`, `subtract()`, `toDecimal()`) instead of `Number()` arithmetic
- `computeBankAccountBalance` returns `{ currentBalance, projectedBalance }` as decimal strings
- Optimized: 3 queries per account instead of 4

**Step 3: Commit**

```bash
git add core/database/src/repositories/bank-accounts-repository.ts core/database/package.json
git commit -m "refactor(database): rewrite bank-accounts repository with Zod validation and @f-o-t/money"
```

---

## Task 5: Add mock factory for bank accounts

**Files:**

- Modify: `apps/web/__tests__/helpers/mock-factories.ts`

**Step 1: Add constant and import**

At top with other constants:

```typescript
export const BANK_ACCOUNT_ID = "ba000000-0000-4000-a000-000000000001";
```

Add import:

```typescript
import type { BankAccount } from "@core/database/schemas/bank-accounts";
```

**Step 2: Add factory function**

```typescript
export function makeBankAccount(
   overrides: Partial<BankAccount> = {},
): BankAccount {
   return {
      id: BANK_ACCOUNT_ID,
      teamId: TEST_TEAM_ID,
      name: "Conta Corrente Principal",
      type: "checking",
      status: "active",
      color: "#6366f1",
      iconUrl: null,
      bankCode: "001",
      bankName: "Banco do Brasil",
      branch: "1234",
      accountNumber: "12345-6",
      initialBalance: "1000.00",
      initialBalanceDate: null,
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      ...overrides,
   };
}
```

**Step 3: Commit**

```bash
git add apps/web/__tests__/helpers/mock-factories.ts
git commit -m "test(bank-accounts): add mock factory"
```

---

## Task 6: Add validator unit tests

**Files:**

- Create: `core/database/__tests__/schemas/bank-accounts-validators.test.ts`

**Step 1: Write tests**

```typescript
import { describe, expect, it } from "vitest";
import {
   createBankAccountSchema,
   updateBankAccountSchema,
} from "../../src/schemas/bank-accounts.validators";

// =============================================================================
// createBankAccountSchema
// =============================================================================

describe("createBankAccountSchema", () => {
   const validChecking = {
      name: "Conta Corrente",
      type: "checking" as const,
      bankCode: "001",
      bankName: "Banco do Brasil",
   };

   it("accepts valid checking account", () => {
      const result = createBankAccountSchema.safeParse(validChecking);
      expect(result.success).toBe(true);
   });

   it("accepts valid cash account without bank details", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Caixa Físico",
         type: "cash",
      });
      expect(result.success).toBe(true);
   });

   it("rejects cash account with bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Caixa",
         type: "cash",
         bankCode: "001",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
         expect(
            result.error.issues.some((i) => i.path.includes("bankCode")),
         ).toBe(true);
      }
   });

   it("rejects cash account with branch", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Caixa",
         type: "cash",
         branch: "1234",
      });
      expect(result.success).toBe(false);
   });

   it("rejects cash account with accountNumber", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Caixa",
         type: "cash",
         accountNumber: "12345",
      });
      expect(result.success).toBe(false);
   });

   it("rejects checking account without bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Conta Corrente",
         type: "checking",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
         expect(
            result.error.issues.some((i) => i.path.includes("bankCode")),
         ).toBe(true);
      }
   });

   it("rejects savings account without bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Poupança",
         type: "savings",
      });
      expect(result.success).toBe(false);
   });

   it("rejects investment account without bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Investimento",
         type: "investment",
      });
      expect(result.success).toBe(false);
   });

   it("rejects payment account without bankCode", () => {
      const result = createBankAccountSchema.safeParse({
         name: "Conta Pagamento",
         type: "payment",
      });
      expect(result.success).toBe(false);
   });

   it("rejects name shorter than 2 characters", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         name: "A",
      });
      expect(result.success).toBe(false);
   });

   it("rejects name longer than 80 characters", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         name: "A".repeat(81),
      });
      expect(result.success).toBe(false);
   });

   it("rejects invalid color format", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         color: "red",
      });
      expect(result.success).toBe(false);
   });

   it("accepts valid hex color", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         color: "#FF5733",
      });
      expect(result.success).toBe(true);
   });

   it("rejects non-numeric initialBalance", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         initialBalance: "abc",
      });
      expect(result.success).toBe(false);
   });

   it("accepts negative initialBalance", () => {
      const result = createBankAccountSchema.safeParse({
         ...validChecking,
         initialBalance: "-500.00",
      });
      expect(result.success).toBe(true);
   });

   it("defaults color to #6366f1", () => {
      const result = createBankAccountSchema.safeParse(validChecking);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.color).toBe("#6366f1");
      }
   });

   it("defaults initialBalance to 0", () => {
      const result = createBankAccountSchema.safeParse(validChecking);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.initialBalance).toBe("0");
      }
   });

   it("accepts all bank-type accounts with bankCode", () => {
      for (const type of ["checking", "savings", "investment", "payment"]) {
         const result = createBankAccountSchema.safeParse({
            name: "Test Account",
            type,
            bankCode: "001",
         });
         expect(result.success).toBe(true);
      }
   });
});

// =============================================================================
// updateBankAccountSchema
// =============================================================================

describe("updateBankAccountSchema", () => {
   it("accepts empty object (all fields optional)", () => {
      const result = updateBankAccountSchema.safeParse({});
      expect(result.success).toBe(true);
   });

   it("accepts partial update with only name", () => {
      const result = updateBankAccountSchema.safeParse({
         name: "Novo Nome",
      });
      expect(result.success).toBe(true);
   });

   it("rejects invalid color on update", () => {
      const result = updateBankAccountSchema.safeParse({
         color: "invalid",
      });
      expect(result.success).toBe(false);
   });

   it("rejects name shorter than 2 chars on update", () => {
      const result = updateBankAccountSchema.safeParse({
         name: "A",
      });
      expect(result.success).toBe(false);
   });

   it("accepts valid color on update", () => {
      const result = updateBankAccountSchema.safeParse({
         color: "#AABBCC",
      });
      expect(result.success).toBe(true);
   });
});
```

**Step 2: Run tests**

Run: `npx vitest run core/database/__tests__/schemas/bank-accounts-validators.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add core/database/__tests__/schemas/bank-accounts-validators.test.ts
git commit -m "test(database): add bank accounts validator tests"
```

---

## Task 7: Write changelog doc

**Files:**

- Create: `docs/core-refactor/database/CHANGELOG-financial-accounts.md`

**Step 1: Write the changelog**

```markdown
# Conta Financeira — Changelog

## O que mudou de "Bank Accounts" para "Conta Financeira"

### Schema (`core/database/src/schemas/bank-accounts.ts`)

| Mudança                    | Antes                      | Depois                                     | Motivo                                                            |
| -------------------------- | -------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| Campo `status`             | Não existia                | `active` \| `archived` (default: `active`) | Contas com lançamentos não podem ser excluídas, apenas arquivadas |
| Campo `initialBalanceDate` | `timestamp` (com timezone) | `date` (apenas data)                       | É uma data no calendário, não um momento no tempo                 |
| Campo `nickname`           | Existia                    | Removido                                   | Redundante com `name` — o spec chama `name` de "apelido"          |
| Índice `status`            | Não existia                | `bank_accounts_status_idx`                 | Queries filtram por status                                        |

### Campos que NÃO foram adicionados (e por quê)

| Campo do spec                  | Decisão         | Motivo                                                                                                           |
| ------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `moeda` / `currency`           | Não adicionado  | Apenas BRL por agora. Quando multi-moeda vier, será uma mudança maior (taxas de câmbio, relatórios consolidados) |
| `origem_dados` / `source`      | Não adicionado  | Transações têm origem, não contas. Open Finance será uma integração própria quando implementado                  |
| `criada_por` / `createdBy`     | Não adicionado  | Será coberto pelo módulo de auditoria centralizado ([#638](https://github.com/F-O-T/montte-nx/issues/638))       |
| `atualizada_por` / `updatedBy` | Não adicionado  | Idem — auditoria centralizada                                                                                    |
| Campos de conciliação          | Não adicionados | Feature Pro/Empresarial. Terá tabela própria (`reconciliation_sessions`)                                         |

### Validators (`core/database/src/schemas/bank-accounts.validators.ts`) — NOVO

- Zod schemas derivados do Drizzle via `createInsertSchema`
- Validação condicional por tipo de conta:
   - **Caixa físico (`cash`)**: bankCode, branch, accountNumber devem ser nulos
   - **Contas bancárias** (`checking`, `savings`, `investment`, `payment`): bankCode obrigatório
- Nome: 2-80 caracteres
- Cor: formato hex `#RRGGBB`
- Saldo inicial: aceita positivo e negativo (spec permite ambos)

### Repository (`core/database/src/repositories/bank-accounts-repository.ts`) — REESCRITO

| Mudança                  | Antes                               | Depois                                            |
| ------------------------ | ----------------------------------- | ------------------------------------------------- |
| Validação                | Nenhuma (confiava no router)        | Zod validation antes de cada operação             |
| Aritmética de saldo      | `Number()` (floating point)         | `@f-o-t/money` (BigInt, precisão exata)           |
| Arquivamento             | Não existia                         | `archiveBankAccount()`, `reactivateBankAccount()` |
| Exclusão                 | Deletava direto                     | Verifica transações; bloqueia se houver           |
| Listagem                 | Retornava todas                     | Filtra por `status = active` por padrão           |
| Interface de criação     | `NewBankAccount` (tipo Drizzle raw) | `CreateBankAccountParams` com validação           |
| Interface de atualização | `Partial<NewBankAccount>`           | `UpdateBankAccountParams` com validação           |

### Testes — NOVOS

- `core/database/__tests__/schemas/bank-accounts-validators.test.ts` — 20+ testes para validadores
- Mock factory `makeBankAccount()` em `apps/web/__tests__/helpers/mock-factories.ts`
```

**Step 2: Commit**

```bash
git add docs/core-refactor/database/CHANGELOG-financial-accounts.md
git commit -m "docs: add changelog for bank accounts → conta financeira refactor"
```

---

## Task 8: Verify everything

**Step 1: Run all tests**

Run: `npx vitest run core/database/__tests__/`
Expected: All pass

**Step 2: Run typecheck on core/database**

Run: `cd core/database && bun run typecheck`
Expected: No new errors

**Step 3: Run formatter**

Run: `bun run format`

**Step 4: Push schema to local DB**

Run: `cd core/database && bun run push`

**Step 5: Commit if formatting changed anything**

```bash
git add -A
git commit -m "chore: format and verify bank accounts core refactor"
```
