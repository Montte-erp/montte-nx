# Cartões de Crédito — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar schemas, validators, materialized view, repositories e testes para o módulo de cartões de crédito com faturas e pagamento integral.

**Architecture:** Evoluir schema de credit cards com status/brand + drizzle-zod validators. Adicionar `statementPeriod` em transactions. Nova tabela `credit_card_statements` + materialized view `credit_card_statement_totals`. Repositories com singleton `db`, relational queries. Testes com PGLite.

**Tech Stack:** Drizzle ORM, drizzle-zod, dayjs, PGLite, Vitest

**Design doc:** `docs/plans/2026-03-09-credit-cards-design.md`

---

### Task 1: Evolve credit cards schema — enums + new columns

**Files:**

- Modify: `core/database/src/schemas/credit-cards.ts`

**Step 1: Add enums and new columns**

Replace the entire file with:

```typescript
import { sql } from "drizzle-orm";
import {
   index,
   integer,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { bankAccounts } from "./bank-accounts";

export const creditCardStatusEnum = pgEnum("credit_card_status", [
   "active",
   "blocked",
   "cancelled",
]);

export const creditCardBrandEnum = pgEnum("credit_card_brand", [
   "visa",
   "mastercard",
   "elo",
   "amex",
   "hipercard",
   "other",
]);

export const creditCards = pgTable(
   "credit_cards",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull().default("#6366f1"),
      iconUrl: text("icon_url"),
      creditLimit: numeric("credit_limit", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      closingDay: integer("closing_day").notNull(),
      dueDay: integer("due_day").notNull(),
      bankAccountId: uuid("bank_account_id")
         .notNull()
         .references(() => bankAccounts.id, { onDelete: "restrict" }),
      status: creditCardStatusEnum("status").notNull().default("active"),
      brand: creditCardBrandEnum("brand"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("credit_cards_team_id_idx").on(table.teamId),
      index("credit_cards_bank_account_id_idx").on(table.bankAccountId),
   ],
);

export type CreditCard = typeof creditCards.$inferSelect;
export type NewCreditCard = typeof creditCards.$inferInsert;
export type CreditCardStatus = (typeof creditCardStatusEnum.enumValues)[number];
export type CreditCardBrand = (typeof creditCardBrandEnum.enumValues)[number];
```

**Key changes from current schema:**

- `bankAccountId` is now `notNull()` with `onDelete: "restrict"` (conta vinculada is required)
- Added `status` enum (active/blocked/cancelled)
- Added `brand` enum (nullable)
- Added type exports for enums

**Step 2: Commit**

```bash
git add core/database/src/schemas/credit-cards.ts
git commit -m "feat(database): add status and brand enums to credit cards schema"
```

---

### Task 2: Add drizzle-zod validators to credit cards

**Files:**

- Modify: `core/database/src/schemas/credit-cards.ts` (append validators)

**Step 1: Add validators at the bottom of the file**

Append after the type exports:

```typescript
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

// =============================================================================
// Validators
// =============================================================================

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(80, "Nome deve ter no máximo 80 caracteres.");

const creditLimitSchema = z.string().refine(
   (v) => {
      const n = Number(v);
      return !Number.isNaN(n) && n >= 0;
   },
   { message: "Limite deve ser um número válido e não negativo." },
);

const colorSchema = z
   .string()
   .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).");

const daySchema = z
   .number()
   .int("Dia deve ser um número inteiro.")
   .min(1, "Dia deve ser entre 1 e 31.")
   .max(31, "Dia deve ser entre 1 e 31.");

const baseCreditCardSchema = createInsertSchema(creditCards).pick({
   name: true,
   color: true,
   iconUrl: true,
   creditLimit: true,
   closingDay: true,
   dueDay: true,
   bankAccountId: true,
   brand: true,
});

export const createCreditCardSchema = baseCreditCardSchema.extend({
   name: nameSchema,
   color: colorSchema.default("#6366f1"),
   creditLimit: creditLimitSchema.default("0"),
   closingDay: daySchema,
   dueDay: daySchema,
   bankAccountId: z.string().uuid("Conta vinculada inválida."),
   brand: z
      .enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"])
      .nullable()
      .optional(),
});

export const updateCreditCardSchema = baseCreditCardSchema
   .extend({
      name: nameSchema.optional(),
      color: colorSchema.optional(),
      creditLimit: creditLimitSchema.optional(),
      closingDay: daySchema.optional(),
      dueDay: daySchema.optional(),
      bankAccountId: z.string().uuid("Conta vinculada inválida.").optional(),
      brand: z
         .enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"])
         .nullable()
         .optional(),
   })
   .partial();

export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
```

**Note:** Move the `import { createInsertSchema }` and `import { z }` to the top of the file with the other imports.

**Step 2: Commit**

```bash
git add core/database/src/schemas/credit-cards.ts
git commit -m "feat(database): add drizzle-zod validators for credit cards"
```

---

### Task 3: Write credit card validator tests

**Files:**

- Create: `core/database/__tests__/schemas/credit-cards-validators.test.ts`

**Step 1: Write the tests**

```typescript
import { describe, expect, it } from "vitest";
import {
   createCreditCardSchema,
   updateCreditCardSchema,
} from "@core/database/schemas/credit-cards";

// =============================================================================
// Helpers
// =============================================================================

function expectPass(input: unknown) {
   const result = createCreditCardSchema.safeParse(input);
   expect(result.success).toBe(true);
   return result;
}

function expectFail(input: unknown, path?: string) {
   const result = createCreditCardSchema.safeParse(input);
   expect(result.success).toBe(false);
   if (path && !result.success) {
      expect(result.error.issues.some((i) => i.path.includes(path))).toBe(true);
   }
}

// =============================================================================
// createCreditCardSchema
// =============================================================================

describe("createCreditCardSchema", () => {
   const validCard = {
      name: "Nubank Visa",
      creditLimit: "5000.00",
      closingDay: 15,
      dueDay: 25,
      bankAccountId: "550e8400-e29b-41d4-a716-446655440000",
   };

   it("accepts valid credit card", () => {
      expectPass(validCard);
   });

   it("accepts card with brand", () => {
      expectPass({ ...validCard, brand: "visa" });
   });

   it("accepts card without brand (nullable)", () => {
      expectPass({ ...validCard, brand: null });
   });

   it("rejects name shorter than 2 characters", () => {
      expectFail({ ...validCard, name: "A" }, "name");
   });

   it("rejects name longer than 80 characters", () => {
      expectFail({ ...validCard, name: "A".repeat(81) }, "name");
   });

   it("rejects negative credit limit", () => {
      expectFail({ ...validCard, creditLimit: "-100" }, "creditLimit");
   });

   it("rejects non-numeric credit limit", () => {
      expectFail({ ...validCard, creditLimit: "abc" }, "creditLimit");
   });

   it("accepts zero credit limit", () => {
      expectPass({ ...validCard, creditLimit: "0" });
   });

   it.each([0, 32, -1, 100])("rejects closingDay = %i", (day) => {
      expectFail({ ...validCard, closingDay: day }, "closingDay");
   });

   it.each([1, 15, 28, 31])("accepts closingDay = %i", (day) => {
      expectPass({ ...validCard, closingDay: day });
   });

   it.each([0, 32, -1, 100])("rejects dueDay = %i", (day) => {
      expectFail({ ...validCard, dueDay: day }, "dueDay");
   });

   it.each([1, 15, 28, 31])("accepts dueDay = %i", (day) => {
      expectPass({ ...validCard, dueDay: day });
   });

   it("rejects invalid color format", () => {
      expectFail({ ...validCard, color: "red" }, "color");
   });

   it("accepts valid hex color", () => {
      expectPass({ ...validCard, color: "#FF5733" });
   });

   it("rejects invalid bankAccountId", () => {
      expectFail(
         { ...validCard, bankAccountId: "not-a-uuid" },
         "bankAccountId",
      );
   });

   it("rejects invalid brand value", () => {
      expectFail({ ...validCard, brand: "diners" }, "brand");
   });

   it("applies correct defaults", () => {
      const result = createCreditCardSchema.safeParse(validCard);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.color).toBe("#6366f1");
         expect(result.data.creditLimit).toBe("0");
      }
   });

   it("uses provided credit limit over default", () => {
      const result = createCreditCardSchema.safeParse(validCard);
      expect(result.success).toBe(true);
      if (result.success) {
         // validCard has creditLimit: "5000.00", but default is "0"
         // Since we explicitly pass it, it should use the passed value
         expect(result.data.creditLimit).toBe("5000.00");
      }
   });
});

// =============================================================================
// updateCreditCardSchema
// =============================================================================

describe("updateCreditCardSchema", () => {
   const parse = (input: unknown) => updateCreditCardSchema.safeParse(input);

   it("accepts empty object (all fields optional)", () => {
      expect(parse({}).success).toBe(true);
   });

   it("accepts partial update with only name", () => {
      expect(parse({ name: "Novo Nome" }).success).toBe(true);
   });

   it("rejects invalid color on update", () => {
      expect(parse({ color: "invalid" }).success).toBe(false);
   });

   it("rejects name shorter than 2 chars on update", () => {
      expect(parse({ name: "A" }).success).toBe(false);
   });

   it("accepts valid brand on update", () => {
      expect(parse({ brand: "mastercard" }).success).toBe(true);
   });

   it("rejects closingDay out of range on update", () => {
      expect(parse({ closingDay: 0 }).success).toBe(false);
      expect(parse({ closingDay: 32 }).success).toBe(false);
   });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd core/database && npx vitest run __tests__/schemas/credit-cards-validators.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add core/database/__tests__/schemas/credit-cards-validators.test.ts
git commit -m "test(database): add credit card validator tests"
```

---

### Task 4: Add `statementPeriod` to transactions schema

**Files:**

- Modify: `core/database/src/schemas/transactions.ts`

**Step 1: Add the column**

Add after `installmentGroupId` in the transactions table definition:

```typescript
      statementPeriod: text("statement_period"),
```

This is nullable — only filled when `creditCardId` is set.

**Step 2: Add index for the materialized view**

Add to the indexes array:

```typescript
      index("transactions_statement_period_idx").on(table.creditCardId, table.statementPeriod),
```

**Step 3: Commit**

```bash
git add core/database/src/schemas/transactions.ts
git commit -m "feat(database): add statementPeriod column to transactions"
```

---

### Task 5: Create credit card statements schema

**Files:**

- Create: `core/database/src/schemas/credit-card-statements.ts`
- Modify: `core/database/src/schema.ts` (add export)

**Step 1: Create the schema file**

```typescript
import { sql } from "drizzle-orm";
import {
   date,
   index,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { bills } from "./bills";
import { creditCards } from "./credit-cards";
import { transactions } from "./transactions";

// =============================================================================
// Enums
// =============================================================================

export const creditCardStatementStatusEnum = pgEnum(
   "credit_card_statement_status",
   ["open", "paid"],
);

// =============================================================================
// Table
// =============================================================================

export const creditCardStatements = pgTable(
   "credit_card_statements",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      creditCardId: uuid("credit_card_id")
         .notNull()
         .references(() => creditCards.id, { onDelete: "restrict" }),
      statementPeriod: text("statement_period").notNull(),
      closingDate: date("closing_date").notNull(),
      dueDate: date("due_date").notNull(),
      status: creditCardStatementStatusEnum("status").notNull().default("open"),
      billId: uuid("bill_id").references(() => bills.id, {
         onDelete: "set null",
      }),
      paymentTransactionId: uuid("payment_transaction_id").references(
         () => transactions.id,
         { onDelete: "set null" },
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("credit_card_statements_credit_card_id_idx").on(table.creditCardId),
      uniqueIndex("credit_card_statements_card_period_idx").on(
         table.creditCardId,
         table.statementPeriod,
      ),
   ],
);

// =============================================================================
// Types
// =============================================================================

export type CreditCardStatement = typeof creditCardStatements.$inferSelect;
export type NewCreditCardStatement = typeof creditCardStatements.$inferInsert;
export type CreditCardStatementStatus =
   (typeof creditCardStatementStatusEnum.enumValues)[number];

// =============================================================================
// Validators
// =============================================================================

const STATEMENT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const baseStatementSchema = createInsertSchema(creditCardStatements).pick({
   creditCardId: true,
   statementPeriod: true,
   closingDate: true,
   dueDate: true,
});

export const createStatementSchema = baseStatementSchema.extend({
   creditCardId: z.string().uuid(),
   statementPeriod: z
      .string()
      .regex(
         STATEMENT_PERIOD_REGEX,
         "Competência deve estar no formato YYYY-MM.",
      ),
   closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
   dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});

export type CreateStatementInput = z.infer<typeof createStatementSchema>;
```

**Step 2: Add export to schema.ts**

In `core/database/src/schema.ts`, add after the `credit-cards` export:

```typescript
export * from "./schemas/credit-card-statements";
```

**Step 3: Commit**

```bash
git add core/database/src/schemas/credit-card-statements.ts core/database/src/schema.ts
git commit -m "feat(database): add credit card statements schema with validators"
```

---

### Task 6: Write credit card statement validator tests

**Files:**

- Create: `core/database/__tests__/schemas/credit-card-statements-validators.test.ts`

**Step 1: Write the tests**

```typescript
import { describe, expect, it } from "vitest";
import { createStatementSchema } from "@core/database/schemas/credit-card-statements";

// =============================================================================
// Helpers
// =============================================================================

function expectPass(input: unknown) {
   const result = createStatementSchema.safeParse(input);
   expect(result.success).toBe(true);
   return result;
}

function expectFail(input: unknown, path?: string) {
   const result = createStatementSchema.safeParse(input);
   expect(result.success).toBe(false);
   if (path && !result.success) {
      expect(result.error.issues.some((i) => i.path.includes(path))).toBe(true);
   }
}

// =============================================================================
// createStatementSchema
// =============================================================================

describe("createStatementSchema", () => {
   const valid = {
      creditCardId: "550e8400-e29b-41d4-a716-446655440000",
      statementPeriod: "2026-03",
      closingDate: "2026-03-15",
      dueDate: "2026-03-25",
   };

   it("accepts valid statement", () => {
      expectPass(valid);
   });

   it("rejects invalid statementPeriod format", () => {
      expectFail({ ...valid, statementPeriod: "2026-3" }, "statementPeriod");
      expectFail({ ...valid, statementPeriod: "03-2026" }, "statementPeriod");
      expectFail({ ...valid, statementPeriod: "2026/03" }, "statementPeriod");
   });

   it("rejects statementPeriod with invalid month", () => {
      expectFail({ ...valid, statementPeriod: "2026-00" }, "statementPeriod");
      expectFail({ ...valid, statementPeriod: "2026-13" }, "statementPeriod");
   });

   it("accepts statementPeriod for all valid months", () => {
      for (let m = 1; m <= 12; m++) {
         expectPass({
            ...valid,
            statementPeriod: `2026-${String(m).padStart(2, "0")}`,
         });
      }
   });

   it("rejects invalid creditCardId", () => {
      expectFail({ ...valid, creditCardId: "not-a-uuid" }, "creditCardId");
   });

   it("rejects invalid closingDate format", () => {
      expectFail({ ...valid, closingDate: "15/03/2026" }, "closingDate");
   });

   it("rejects invalid dueDate format", () => {
      expectFail({ ...valid, dueDate: "25/03/2026" }, "dueDate");
   });
});
```

**Step 2: Run tests**

Run: `cd core/database && npx vitest run __tests__/schemas/credit-card-statements-validators.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add core/database/__tests__/schemas/credit-card-statements-validators.test.ts
git commit -m "test(database): add credit card statement validator tests"
```

---

### Task 7: Create materialized view

**Files:**

- Create: `core/database/src/schemas/credit-card-statement-totals.ts`
- Modify: `core/database/src/schema.ts` (add export)

**Step 1: Create the materialized view file**

```typescript
import { sql } from "drizzle-orm";
import { pgMaterializedView } from "drizzle-orm/pg-core";
import { transactions } from "./transactions";

export const creditCardStatementTotals = pgMaterializedView(
   "credit_card_statement_totals",
).as((qb) =>
   qb
      .select({
         creditCardId: transactions.creditCardId,
         statementPeriod: transactions.statementPeriod,
         totalPurchases:
            sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`.as(
               "total_purchases",
            ),
         transactionCount: sql<number>`COUNT(*)::int`.as("transaction_count"),
      })
      .from(transactions)
      .where(sql`${transactions.creditCardId} IS NOT NULL`)
      .groupBy(transactions.creditCardId, transactions.statementPeriod),
);
```

**Step 2: Add export to schema.ts**

In `core/database/src/schema.ts`, add after the `credit-card-statements` export:

```typescript
export * from "./schemas/credit-card-statement-totals";
```

**Step 3: Commit**

```bash
git add core/database/src/schemas/credit-card-statement-totals.ts core/database/src/schema.ts
git commit -m "feat(database): add credit card statement totals materialized view"
```

---

### Task 8: Add relations for credit cards and statements

**Files:**

- Modify: `core/database/src/relations.ts`

**Step 1: Add credit card relations**

Add after the `// Transactions` section or in a new `// Credit Cards` section:

```typescript
   // -------------------------------------------------------------------------
   // Credit Cards
   // -------------------------------------------------------------------------
   creditCards: {
      bankAccount: r.one.bankAccounts({
         from: r.creditCards.bankAccountId,
         to: r.bankAccounts.id,
      }),
      statements: r.many.creditCardStatements(),
   },

   creditCardStatements: {
      creditCard: r.one.creditCards({
         from: r.creditCardStatements.creditCardId,
         to: r.creditCards.id,
      }),
      bill: r.one.bills({
         from: r.creditCardStatements.billId,
         to: r.bills.id,
      }),
      paymentTransaction: r.one.transactions({
         from: r.creditCardStatements.paymentTransactionId,
         to: r.transactions.id,
      }),
   },
```

Also add `creditCards: r.many.creditCards()` to the existing `bankAccounts` relation (if not present — check first; currently there's no `bankAccounts` relation defined, so you may need to add one):

```typescript
   // -------------------------------------------------------------------------
   // Bank Accounts
   // -------------------------------------------------------------------------
   bankAccounts: {
      bills: r.many.bills(),
      transactions: r.many.transactions(),
      creditCards: r.many.creditCards(),
   },
```

**Step 2: Commit**

```bash
git add core/database/src/relations.ts
git commit -m "feat(database): add relations for credit cards and statements"
```

---

### Task 9: Create `computeStatementPeriod` helper + tests

**Files:**

- Create: `core/database/src/helpers/credit-card-dates.ts`
- Create: `core/database/__tests__/helpers/credit-card-dates.test.ts`

**Step 1: Write the failing tests first**

```typescript
import { describe, expect, it } from "vitest";
import {
   computeStatementPeriod,
   computeClosingDate,
   computeDueDate,
} from "@core/database/helpers/credit-card-dates";

describe("computeStatementPeriod", () => {
   it("returns same month when purchase is before closing day", () => {
      expect(computeStatementPeriod("2026-03-10", 15)).toBe("2026-03");
   });

   it("returns same month when purchase is on closing day", () => {
      expect(computeStatementPeriod("2026-03-15", 15)).toBe("2026-03");
   });

   it("returns next month when purchase is after closing day", () => {
      expect(computeStatementPeriod("2026-03-20", 15)).toBe("2026-04");
   });

   it("handles year rollover (December → January)", () => {
      expect(computeStatementPeriod("2026-12-20", 15)).toBe("2027-01");
   });

   it("handles purchase on closing day at end of month", () => {
      expect(computeStatementPeriod("2026-01-31", 31)).toBe("2026-01");
   });
});

describe("computeClosingDate", () => {
   it("returns closing date for the given period", () => {
      expect(computeClosingDate("2026-03", 15)).toBe("2026-03-15");
   });

   it("clamps closing day to last day of month (Feb)", () => {
      expect(computeClosingDate("2026-02", 31)).toBe("2026-02-28");
   });

   it("clamps closing day to last day of month (Apr)", () => {
      expect(computeClosingDate("2026-04", 31)).toBe("2026-04-30");
   });
});

describe("computeDueDate", () => {
   it("returns same month when dueDay >= closingDay", () => {
      expect(computeDueDate("2026-03", 15, 25)).toBe("2026-03-25");
   });

   it("returns next month when dueDay < closingDay", () => {
      expect(computeDueDate("2026-03", 25, 5)).toBe("2026-04-05");
   });

   it("handles year rollover", () => {
      expect(computeDueDate("2026-12", 25, 5)).toBe("2027-01-05");
   });

   it("clamps due day to last day of target month", () => {
      expect(computeDueDate("2026-01", 25, 31)).toBe("2026-02-28");
   });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd core/database && npx vitest run __tests__/helpers/credit-card-dates.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import dayjs from "dayjs";

/**
 * Computes which statement period (YYYY-MM) a purchase falls into.
 *
 * If purchase date <= closing day → same month.
 * If purchase date > closing day → next month.
 */
export function computeStatementPeriod(
   purchaseDate: string,
   closingDay: number,
): string {
   const date = dayjs(purchaseDate);
   if (date.date() <= closingDay) {
      return date.format("YYYY-MM");
   }
   return date.add(1, "month").format("YYYY-MM");
}

/**
 * Computes the closing date for a statement period.
 * Clamps to the last day of the month if closingDay exceeds it.
 */
export function computeClosingDate(
   statementPeriod: string,
   closingDay: number,
): string {
   const date = dayjs(`${statementPeriod}-01`);
   const lastDay = date.daysInMonth();
   const clampedDay = Math.min(closingDay, lastDay);
   return date.date(clampedDay).format("YYYY-MM-DD");
}

/**
 * Computes the due date for a statement period.
 * If dueDay < closingDay, the due date falls in the next month.
 * Clamps to last day of the target month.
 */
export function computeDueDate(
   statementPeriod: string,
   closingDay: number,
   dueDay: number,
): string {
   const base = dayjs(`${statementPeriod}-01`);
   const targetMonth = dueDay < closingDay ? base.add(1, "month") : base;
   const lastDay = targetMonth.daysInMonth();
   const clampedDay = Math.min(dueDay, lastDay);
   return targetMonth.date(clampedDay).format("YYYY-MM-DD");
}
```

**Step 4: Add export to package.json**

In `core/database/package.json`, add to exports:

```json
"./helpers/*": "./src/helpers/*.ts"
```

**Step 5: Run tests to verify they pass**

Run: `cd core/database && npx vitest run __tests__/helpers/credit-card-dates.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add core/database/src/helpers/credit-card-dates.ts core/database/__tests__/helpers/credit-card-dates.test.ts core/database/package.json
git commit -m "feat(database): add computeStatementPeriod, computeClosingDate, computeDueDate helpers with dayjs"
```

---

### Task 10: Rewrite credit cards repository (singleton pattern)

**Files:**

- Modify: `core/database/src/repositories/credit-cards-repository.ts`

**Step 1: Rewrite the repository**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { eq } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateCreditCardInput,
   type UpdateCreditCardInput,
   creditCards,
   createCreditCardSchema,
   updateCreditCardSchema,
} from "@core/database/schemas/credit-cards";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";

// =============================================================================
// Create
// =============================================================================

export async function createCreditCard(
   teamId: string,
   data: CreateCreditCardInput,
) {
   const validated = validateInput(createCreditCardSchema, data);
   try {
      const [card] = await db
         .insert(creditCards)
         .values({ ...validated, teamId })
         .returning();
      if (!card) throw AppError.database("Failed to create credit card");
      return card;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create credit card");
   }
}

// =============================================================================
// Read
// =============================================================================

export async function listCreditCards(teamId: string) {
   try {
      return await db.query.creditCards.findMany({
         where: { teamId },
         orderBy: { createdAt: "desc" },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list credit cards");
   }
}

export async function getCreditCard(id: string) {
   try {
      const card = await db.query.creditCards.findFirst({
         where: { id },
      });
      return card ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get credit card");
   }
}

// =============================================================================
// Update
// =============================================================================

export async function updateCreditCard(
   id: string,
   data: UpdateCreditCardInput,
) {
   const validated = validateInput(updateCreditCardSchema, data);
   try {
      const [updated] = await db
         .update(creditCards)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(creditCards.id, id))
         .returning();
      if (!updated)
         throw AppError.notFound("Cartão de crédito não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update credit card");
   }
}

// =============================================================================
// Delete
// =============================================================================

export async function deleteCreditCard(id: string) {
   try {
      const hasOpenStatements = await creditCardHasOpenStatements(id);
      if (hasOpenStatements) {
         throw AppError.conflict(
            "Cartão com faturas abertas não pode ser excluído.",
         );
      }
      await db.delete(creditCards).where(eq(creditCards.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete credit card");
   }
}

// =============================================================================
// Helpers
// =============================================================================

export async function creditCardHasOpenStatements(creditCardId: string) {
   try {
      const statement = await db.query.creditCardStatements.findFirst({
         where: { creditCardId, status: "open" },
      });
      return !!statement;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check credit card statements");
   }
}
```

**Step 2: Commit**

```bash
git add core/database/src/repositories/credit-cards-repository.ts
git commit -m "refactor(database): rewrite credit cards repository with singleton pattern"
```

---

### Task 11: Create credit card statements repository

**Files:**

- Create: `core/database/src/repositories/credit-card-statements-repository.ts`

**Step 1: Write the repository**

```typescript
import { AppError, propagateError } from "@core/utils/errors";
import { and, eq, sql } from "drizzle-orm";
import dayjs from "dayjs";
import { db } from "@core/database/client";
import { creditCards } from "@core/database/schemas/credit-cards";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { creditCardStatementTotals } from "@core/database/schemas/credit-card-statement-totals";
import { transactions } from "@core/database/schemas/transactions";
import { bills } from "@core/database/schemas/bills";
import {
   computeClosingDate,
   computeDueDate,
} from "@core/database/helpers/credit-card-dates";

// =============================================================================
// Read
// =============================================================================

export async function getStatement(id: string) {
   try {
      const [row] = await db
         .select({
            statement: creditCardStatements,
            totalPurchases: creditCardStatementTotals.totalPurchases,
            transactionCount: creditCardStatementTotals.transactionCount,
         })
         .from(creditCardStatements)
         .leftJoin(
            creditCardStatementTotals,
            and(
               eq(
                  creditCardStatements.creditCardId,
                  creditCardStatementTotals.creditCardId,
               ),
               eq(
                  creditCardStatements.statementPeriod,
                  creditCardStatementTotals.statementPeriod,
               ),
            ),
         )
         .where(eq(creditCardStatements.id, id));
      if (!row) return null;
      return {
         ...row.statement,
         totalPurchases: row.totalPurchases ?? "0",
         transactionCount: row.transactionCount ?? 0,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get statement");
   }
}

export async function listStatements(creditCardId: string) {
   try {
      return await db
         .select({
            statement: creditCardStatements,
            totalPurchases: creditCardStatementTotals.totalPurchases,
            transactionCount: creditCardStatementTotals.transactionCount,
         })
         .from(creditCardStatements)
         .leftJoin(
            creditCardStatementTotals,
            and(
               eq(
                  creditCardStatements.creditCardId,
                  creditCardStatementTotals.creditCardId,
               ),
               eq(
                  creditCardStatements.statementPeriod,
                  creditCardStatementTotals.statementPeriod,
               ),
            ),
         )
         .where(eq(creditCardStatements.creditCardId, creditCardId))
         .orderBy(creditCardStatements.statementPeriod);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list statements");
   }
}

// =============================================================================
// Get or Create (lazy)
// =============================================================================

export async function getOrCreateStatement(
   creditCardId: string,
   statementPeriod: string,
) {
   try {
      const existing = await db.query.creditCardStatements.findFirst({
         where: { creditCardId, statementPeriod },
      });
      if (existing) return existing;

      const card = await db.query.creditCards.findFirst({
         where: { id: creditCardId },
      });
      if (!card) throw AppError.notFound("Cartão de crédito não encontrado.");

      const closingDate = computeClosingDate(statementPeriod, card.closingDay);
      const dueDate = computeDueDate(
         statementPeriod,
         card.closingDay,
         card.dueDay,
      );

      const [statement] = await db
         .insert(creditCardStatements)
         .values({
            creditCardId,
            statementPeriod,
            closingDate,
            dueDate,
         })
         .onConflictDoNothing()
         .returning();

      // Race condition: another process may have created it
      if (!statement) {
         const found = await db.query.creditCardStatements.findFirst({
            where: { creditCardId, statementPeriod },
         });
         if (!found) throw AppError.database("Failed to create statement");
         return found;
      }

      // Create a bill for the statement (contas a pagar)
      const [bill] = await db
         .insert(bills)
         .values({
            teamId: card.teamId,
            name: `Fatura ${card.name} - ${dayjs(`${statementPeriod}-01`).format("MM/YYYY")}`,
            type: "payable",
            status: "pending",
            amount: "0",
            dueDate,
            bankAccountId: card.bankAccountId,
         })
         .returning();

      if (bill) {
         await db
            .update(creditCardStatements)
            .set({ billId: bill.id })
            .where(eq(creditCardStatements.id, statement.id));
         statement.billId = bill.id;
      }

      return statement;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get or create statement");
   }
}

// =============================================================================
// Pay Statement
// =============================================================================

export async function payStatement(statementId: string, paymentDate: string) {
   try {
      return await db.transaction(async (tx) => {
         // 1. Get statement with totals
         const [row] = await tx
            .select({
               statement: creditCardStatements,
               totalPurchases: creditCardStatementTotals.totalPurchases,
            })
            .from(creditCardStatements)
            .leftJoin(
               creditCardStatementTotals,
               and(
                  eq(
                     creditCardStatements.creditCardId,
                     creditCardStatementTotals.creditCardId,
                  ),
                  eq(
                     creditCardStatements.statementPeriod,
                     creditCardStatementTotals.statementPeriod,
                  ),
               ),
            )
            .where(eq(creditCardStatements.id, statementId));

         if (!row) throw AppError.notFound("Fatura não encontrada.");
         if (row.statement.status === "paid") {
            throw AppError.conflict("Fatura já está paga.");
         }

         const today = dayjs(paymentDate);
         if (today.isBefore(dayjs(row.statement.closingDate))) {
            throw AppError.validation("Fatura ainda não está fechada.");
         }

         // 2. Get credit card for account info
         const card = await tx.query.creditCards.findFirst({
            where: { id: row.statement.creditCardId },
         });
         if (!card) throw AppError.notFound("Cartão não encontrado.");

         const amount = row.totalPurchases ?? "0";
         const period = dayjs(`${row.statement.statementPeriod}-01`).format(
            "MM/YYYY",
         );

         // 3. Create debit transaction on linked bank account
         const [paymentTx] = await tx
            .insert(transactions)
            .values({
               teamId: card.teamId,
               name: `Pagamento fatura ${card.name} - ${period}`,
               type: "expense",
               amount,
               date: paymentDate,
               bankAccountId: card.bankAccountId,
               paymentMethod: "debit_card",
            })
            .returning();

         if (!paymentTx)
            throw AppError.database("Failed to create payment transaction");

         // 4. Update bill as paid
         if (row.statement.billId) {
            await tx
               .update(bills)
               .set({
                  status: "paid",
                  paidAt: new Date(),
                  amount,
                  transactionId: paymentTx.id,
               })
               .where(eq(bills.id, row.statement.billId));
         }

         // 5. Update statement
         const [updated] = await tx
            .update(creditCardStatements)
            .set({
               status: "paid",
               paymentTransactionId: paymentTx.id,
               updatedAt: new Date(),
            })
            .where(eq(creditCardStatements.id, statementId))
            .returning();

         return updated;
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to pay statement");
   }
}

// =============================================================================
// Available Limit
// =============================================================================

export async function getAvailableLimit(creditCardId: string) {
   try {
      const card = await db.query.creditCards.findFirst({
         where: { id: creditCardId },
      });
      if (!card) throw AppError.notFound("Cartão não encontrado.");

      const [row] = await db
         .select({
            totalPending: sql<string>`COALESCE(SUM(${creditCardStatementTotals.totalPurchases}::numeric), 0)`,
         })
         .from(creditCardStatementTotals)
         .innerJoin(
            creditCardStatements,
            and(
               eq(
                  creditCardStatementTotals.creditCardId,
                  creditCardStatements.creditCardId,
               ),
               eq(
                  creditCardStatementTotals.statementPeriod,
                  creditCardStatements.statementPeriod,
               ),
            ),
         )
         .where(
            and(
               eq(creditCardStatements.creditCardId, creditCardId),
               eq(creditCardStatements.status, "open"),
            ),
         );

      const totalPending = Number(row?.totalPending ?? "0");
      const limit = Number(card.creditLimit);
      const available = Math.max(0, limit - totalPending);

      return {
         creditLimit: card.creditLimit,
         totalPending: String(totalPending),
         availableLimit: String(available),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to compute available limit");
   }
}
```

**Step 2: Add export to package.json**

In `core/database/package.json`, ensure the repositories wildcard export covers this file (it should already via `"./repositories/*"`).

**Step 3: Commit**

```bash
git add core/database/src/repositories/credit-card-statements-repository.ts
git commit -m "feat(database): add credit card statements repository with getOrCreate, pay, and limit"
```

---

### Task 12: Write repository integration tests (PGLite)

**Files:**

- Create: `core/database/__tests__/repositories/credit-cards-repository.test.ts`

**Step 1: Write the tests**

This test file uses PGLite + `withTestTransaction`. Note that since the repository uses the singleton `db`, the tests need to **mock the `db` import** to use the PGLite instance instead.

```typescript
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb, withTestTransaction } from "../helpers/setup-test-db";
import type { DatabaseInstance } from "@core/database/client";

// Mock the singleton db to use PGLite
let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
   vi.doMock("@core/database/client", () => ({ db: testDb.db }));
});

afterAll(async () => {
   await testDb.cleanup();
   vi.restoreAllMocks();
});

describe("credit-cards-repository", () => {
   it("creates a credit card", async () => {
      const { createCreditCard } =
         await import("@core/database/repositories/credit-cards-repository");
      await withTestTransaction(testDb.db, async (tx) => {
         // Need to temporarily set mock to tx
         vi.doMock("@core/database/client", () => ({ db: tx }));
         const { createCreditCard: create } =
            await import("@core/database/repositories/credit-cards-repository");

         const card = await create("550e8400-e29b-41d4-a716-446655440000", {
            name: "Nubank Visa",
            creditLimit: "5000.00",
            closingDay: 15,
            dueDay: 25,
            bankAccountId: "550e8400-e29b-41d4-a716-446655440001",
         });

         expect(card).toBeDefined();
         expect(card.name).toBe("Nubank Visa");
         expect(card.status).toBe("active");
      });
   });
});
```

**Important note:** The singleton `db` mock pattern is tricky. An alternative approach is to first insert a bank account in the test setup, then test the credit card operations. Since the repository uses `db` directly, you need to mock the module. Consult the `@drizzle-pglite-testing` skill for the recommended mocking approach.

**Step 2: Run tests**

Run: `cd core/database && npx vitest run __tests__/repositories/credit-cards-repository.test.ts`
Expected: Tests PASS

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/credit-cards-repository.test.ts
git commit -m "test(database): add credit cards repository integration tests"
```

---

### Task 13: Write materialized view integration test (PGLite)

**Files:**

- Create: `core/database/__tests__/views/credit-card-statement-totals.test.ts`

**Step 1: Write the test**

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { creditCardStatementTotals } from "@core/database/schemas/credit-card-statement-totals";
import { transactions } from "@core/database/schemas/transactions";
import { creditCards } from "@core/database/schemas/credit-cards";
import { bankAccounts } from "@core/database/schemas/bank-accounts";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

describe("creditCardStatementTotals materialized view", () => {
   it("aggregates transactions by credit card and statement period", async () => {
      const db = testDb.db;

      // Insert bank account
      const [account] = await db
         .insert(bankAccounts)
         .values({
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Conta Corrente",
            type: "checking",
            bankCode: "001",
         })
         .returning();

      // Insert credit card
      const [card] = await db
         .insert(creditCards)
         .values({
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Nubank",
            creditLimit: "5000.00",
            closingDay: 15,
            dueDay: 25,
            bankAccountId: account.id,
         })
         .returning();

      // Insert transactions for the card
      await db.insert(transactions).values([
         {
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Mercado",
            type: "expense",
            amount: "150.00",
            date: "2026-03-10",
            creditCardId: card.id,
            statementPeriod: "2026-03",
         },
         {
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Gasolina",
            type: "expense",
            amount: "200.00",
            date: "2026-03-12",
            creditCardId: card.id,
            statementPeriod: "2026-03",
         },
         {
            teamId: "550e8400-e29b-41d4-a716-446655440000",
            name: "Restaurante",
            type: "expense",
            amount: "80.00",
            date: "2026-04-05",
            creditCardId: card.id,
            statementPeriod: "2026-04",
         },
      ]);

      // Refresh the materialized view
      await db.refreshMaterializedView(creditCardStatementTotals);

      // Query the view
      const rows = await db.select().from(creditCardStatementTotals);

      expect(rows).toHaveLength(2);

      const march = rows.find((r) => r.statementPeriod === "2026-03");
      expect(march).toBeDefined();
      expect(Number(march!.totalPurchases)).toBe(350);
      expect(march!.transactionCount).toBe(2);

      const april = rows.find((r) => r.statementPeriod === "2026-04");
      expect(april).toBeDefined();
      expect(Number(april!.totalPurchases)).toBe(80);
      expect(april!.transactionCount).toBe(1);
   });
});
```

**Step 2: Run test**

Run: `cd core/database && npx vitest run __tests__/views/credit-card-statement-totals.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add core/database/__tests__/views/credit-card-statement-totals.test.ts
git commit -m "test(database): add materialized view integration test with PGLite"
```

---

### Task 14: Add transaction protection for paid statements

**Files:**

- Create: `core/database/src/helpers/statement-guard.ts`
- Create: `core/database/__tests__/helpers/statement-guard.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

describe("assertTransactionEditable", () => {
   it("throws when transaction belongs to a paid statement", async () => {
      // This test validates the guard logic.
      // Full integration test with PGLite is in the repository tests.
      const { assertTransactionEditable } =
         await import("@core/database/helpers/statement-guard");

      // Mock db to return a paid statement
      vi.doMock("@core/database/client", () => ({
         db: {
            query: {
               creditCardStatements: {
                  findFirst: vi.fn().mockResolvedValue({ status: "paid" }),
               },
            },
         },
      }));

      const { assertTransactionEditable: guard } =
         await import("@core/database/helpers/statement-guard");

      await expect(guard("card-id", "2026-03")).rejects.toThrow(
         "Não é possível editar lançamento de fatura paga.",
      );
   });
});
```

**Step 2: Write the implementation**

```typescript
import { AppError } from "@core/utils/errors";
import { db } from "@core/database/client";

/**
 * Throws if the transaction's statement is already paid.
 * Call before update/delete of any transaction with creditCardId.
 */
export async function assertTransactionEditable(
   creditCardId: string,
   statementPeriod: string,
) {
   const statement = await db.query.creditCardStatements.findFirst({
      where: { creditCardId, statementPeriod, status: "paid" },
   });
   if (statement) {
      throw AppError.conflict(
         "Não é possível editar lançamento de fatura paga.",
      );
   }
}
```

**Step 3: Commit**

```bash
git add core/database/src/helpers/statement-guard.ts core/database/__tests__/helpers/statement-guard.test.ts
git commit -m "feat(database): add statement guard to protect transactions in paid statements"
```

---

### Summary

| Task | Description                                         | Type            |
| ---- | --------------------------------------------------- | --------------- |
| 1    | Evolve credit cards schema (enums + columns)        | Schema          |
| 2    | Add drizzle-zod validators to credit cards          | Validators      |
| 3    | Write credit card validator tests                   | Tests           |
| 4    | Add `statementPeriod` to transactions               | Schema          |
| 5    | Create credit card statements schema + validators   | Schema          |
| 6    | Write statement validator tests                     | Tests           |
| 7    | Create materialized view                            | Schema          |
| 8    | Add relations for credit cards + statements         | Relations       |
| 9    | Create date helpers (`computeStatementPeriod` etc.) | Helpers + Tests |
| 10   | Rewrite credit cards repository (singleton)         | Repository      |
| 11   | Create statements repository                        | Repository      |
| 12   | Write repository integration tests                  | Tests           |
| 13   | Write materialized view integration test            | Tests           |
| 14   | Add transaction protection guard                    | Guard + Tests   |

**Issues tracked separately:**

- #639 — Notificações de fechamento/vencimento
- #640 — Cron job de refresh da materialized view no worker
