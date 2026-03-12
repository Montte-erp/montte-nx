# Transactions, Bills & Contacts Refactoring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor transactions, bills, and contacts repositories to singleton db + Zod validators + @f-o-t/money pattern, add archive for contacts, and full PGlite test coverage.

**Architecture:** Three repositories refactored independently. Schemas get Zod validators added. Contacts gets isArchived + archive/reactivate. Consumers (routers, workers) updated to new signatures (no db param). Credit card statements repository updated for singleton db.

**Tech Stack:** Drizzle ORM, Zod, @f-o-t/money, PGlite, Vitest

---

### Task 1: Contacts schema + validators

**Files:**

- Modify: `core/database/src/schemas/contacts.ts`

**Context:** Contacts schema currently has no Zod validators and no `isArchived` field. We need to add both. Follow the pattern from `bank-accounts.ts` schema (which has `createBankAccountSchema`, `updateBankAccountSchema`, `numericPositive` helpers, and type exports).

**Step 1: Add isArchived field and Zod validators to contacts.ts**

Add `boolean` to the drizzle imports, add `isArchived` field to the table, add `createInsertSchema` from `drizzle-orm/zod`, add `z` from `zod`, and create validators.

```typescript
// Add to imports:
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

// Add to contacts table columns (after externalId):
isArchived: boolean("is_archived").notNull().default(false),

// Add after type exports:
const baseContactSchema = createInsertSchema(contacts).pick({
   name: true,
   type: true,
   email: true,
   phone: true,
   document: true,
   documentType: true,
   notes: true,
});

export const createContactSchema = baseContactSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   type: z.enum(["cliente", "fornecedor", "ambos"], {
      required_error: "Tipo de contato é obrigatório.",
   }),
   email: z.string().email("Email inválido.").nullable().optional(),
   phone: z.string().max(20, "Telefone deve ter no máximo 20 caracteres.").nullable().optional(),
   document: z.string().max(20, "Documento deve ter no máximo 20 caracteres.").nullable().optional(),
   documentType: z.enum(["cpf", "cnpj"]).nullable().optional(),
   notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres.").nullable().optional(),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
```

**Step 2: Run typecheck**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`
Expected: No errors (or only pre-existing unrelated errors)

**Step 3: Commit**

```bash
git add core/database/src/schemas/contacts.ts
git commit -m "feat(database): add isArchived field and Zod validators to contacts schema"
```

---

### Task 2: Contacts repository refactor

**Files:**

- Modify: `core/database/src/repositories/contacts-repository.ts`

**Context:** Current contacts repository uses `db: DatabaseInstance` parameter pattern. Refactor to singleton `db` import, `validateInput`, and add `archiveContact`/`reactivateContact`. The `deleteContact` must check both transactions AND bills. Follow `bank-accounts-repository.ts` pattern exactly.

**Step 1: Rewrite contacts-repository.ts**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, count, eq, or } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateContactInput,
   type UpdateContactInput,
   type ContactType,
   contacts,
   createContactSchema,
   updateContactSchema,
} from "@core/database/schemas/contacts";
import { transactions } from "@core/database/schemas/transactions";
import { bills } from "@core/database/schemas/bills";

export async function createContact(teamId: string, data: CreateContactInput) {
   const validated = validateInput(createContactSchema, data);
   try {
      const [contact] = await db
         .insert(contacts)
         .values({ ...validated, teamId })
         .returning();
      if (!contact) throw AppError.database("Failed to create contact");
      return contact;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create contact");
   }
}

export async function listContacts(
   teamId: string,
   type?: ContactType,
   includeArchived = false,
) {
   try {
      const conditions = [eq(contacts.teamId, teamId)];
      if (type) conditions.push(eq(contacts.type, type));
      if (!includeArchived) conditions.push(eq(contacts.isArchived, false));
      return await db
         .select()
         .from(contacts)
         .where(and(...conditions))
         .orderBy(contacts.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list contacts");
   }
}

export async function getContact(id: string) {
   try {
      const [contact] = await db
         .select()
         .from(contacts)
         .where(eq(contacts.id, id));
      return contact ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get contact");
   }
}

export async function updateContact(id: string, data: UpdateContactInput) {
   const validated = validateInput(updateContactSchema, data);
   try {
      const [updated] = await db
         .update(contacts)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(contacts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Contato não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update contact");
   }
}

export async function archiveContact(id: string) {
   try {
      const [updated] = await db
         .update(contacts)
         .set({ isArchived: true, updatedAt: new Date() })
         .where(eq(contacts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Contato não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive contact");
   }
}

export async function reactivateContact(id: string) {
   try {
      const [updated] = await db
         .update(contacts)
         .set({ isArchived: false, updatedAt: new Date() })
         .where(eq(contacts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Contato não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate contact");
   }
}

export async function deleteContact(id: string) {
   try {
      const hasLinks = await contactHasLinks(id);
      if (hasLinks) {
         throw AppError.conflict(
            "Contato possui lançamentos vinculados. Arquive em vez de excluir.",
         );
      }
      await db.delete(contacts).where(eq(contacts.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete contact");
   }
}

export async function contactHasLinks(id: string): Promise<boolean> {
   try {
      const [txResult] = await db
         .select({ total: count() })
         .from(transactions)
         .where(eq(transactions.contactId, id));

      if ((txResult?.total ?? 0) > 0) return true;

      const [billResult] = await db
         .select({ total: count() })
         .from(bills)
         .where(eq(bills.contactId, id));

      return (billResult?.total ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check contact links");
   }
}
```

**Step 2: Run typecheck**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 3: Commit**

```bash
git add core/database/src/repositories/contacts-repository.ts
git commit -m "refactor(database): rewrite contacts repository with singleton db pattern"
```

---

### Task 3: Contacts repository tests

**Files:**

- Create: `core/database/__tests__/repositories/contacts-repository.test.ts`

**Context:** Test the contacts repository with PGlite. Follow the `bank-accounts-repository.test.ts` pattern exactly: `setupTestDb`, `vi.mock`, `randomTeamId`, `validCreateInput` helper.

**Step 1: Write contacts-repository.test.ts**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { transactions } from "@core/database/schemas/transactions";
import { bills } from "@core/database/schemas/bills";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import * as repo from "../../src/repositories/contacts-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

function validCreateInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "João Silva",
      type: "cliente" as const,
      ...overrides,
   };
}

describe("contacts-repository", () => {
   describe("validators", () => {
      it("rejects name shorter than 2 characters", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createContact(teamId, validCreateInput({ name: "A" })),
         ).rejects.toThrow(/mínimo 2/);
      });

      it("rejects name longer than 120 characters", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createContact(
               teamId,
               validCreateInput({ name: "A".repeat(121) }),
            ),
         ).rejects.toThrow(/máximo 120/);
      });

      it("rejects invalid email", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createContact(
               teamId,
               validCreateInput({ email: "not-an-email" }),
            ),
         ).rejects.toThrow(/Email/i);
      });
   });

   describe("createContact", () => {
      it("creates a contact and returns it", async () => {
         const teamId = randomTeamId();
         const contact = await repo.createContact(teamId, validCreateInput());

         expect(contact).toMatchObject({
            teamId,
            name: "João Silva",
            type: "cliente",
            isArchived: false,
         });
         expect(contact.id).toBeDefined();
      });
   });

   describe("listContacts", () => {
      it("lists active contacts only by default", async () => {
         const teamId = randomTeamId();
         await repo.createContact(teamId, validCreateInput({ name: "Active" }));
         const archived = await repo.createContact(
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveContact(archived.id);

         const list = await repo.listContacts(teamId);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Active");
      });

      it("lists all contacts when includeArchived is true", async () => {
         const teamId = randomTeamId();
         await repo.createContact(
            teamId,
            validCreateInput({ name: "Contact A" }),
         );
         const b = await repo.createContact(
            teamId,
            validCreateInput({ name: "Contact B" }),
         );
         await repo.archiveContact(b.id);

         const list = await repo.listContacts(teamId, undefined, true);
         expect(list).toHaveLength(2);
      });

      it("filters by type", async () => {
         const teamId = randomTeamId();
         await repo.createContact(
            teamId,
            validCreateInput({ name: "Cliente", type: "cliente" }),
         );
         await repo.createContact(
            teamId,
            validCreateInput({ name: "Fornecedor", type: "fornecedor" }),
         );

         const list = await repo.listContacts(teamId, "fornecedor");
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Fornecedor");
      });
   });

   describe("getContact", () => {
      it("returns contact by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createContact(teamId, validCreateInput());

         const found = await repo.getContact(created.id);
         expect(found).toMatchObject({ id: created.id, name: "João Silva" });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getContact(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateContact", () => {
      it("updates a contact", async () => {
         const teamId = randomTeamId();
         const created = await repo.createContact(teamId, validCreateInput());

         const updated = await repo.updateContact(created.id, {
            name: "Maria Silva",
         });

         expect(updated.name).toBe("Maria Silva");
         expect(updated.id).toBe(created.id);
      });
   });

   describe("archiveContact", () => {
      it("archives a contact", async () => {
         const teamId = randomTeamId();
         const created = await repo.createContact(teamId, validCreateInput());

         const archived = await repo.archiveContact(created.id);
         expect(archived.isArchived).toBe(true);
      });
   });

   describe("reactivateContact", () => {
      it("reactivates an archived contact", async () => {
         const teamId = randomTeamId();
         const created = await repo.createContact(teamId, validCreateInput());
         await repo.archiveContact(created.id);

         const reactivated = await repo.reactivateContact(created.id);
         expect(reactivated.isArchived).toBe(false);
      });
   });

   describe("deleteContact", () => {
      it("deletes a contact without links", async () => {
         const teamId = randomTeamId();
         const created = await repo.createContact(teamId, validCreateInput());

         await repo.deleteContact(created.id);
         const found = await repo.getContact(created.id);
         expect(found).toBeNull();
      });

      it("rejects deleting a contact with transactions", async () => {
         const teamId = randomTeamId();
         const contact = await repo.createContact(teamId, validCreateInput());

         const [account] = await testDb.db
            .insert(bankAccounts)
            .values({
               teamId,
               name: "Conta",
               type: "checking",
               initialBalance: "0",
            })
            .returning();

         await testDb.db.insert(transactions).values({
            teamId,
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account!.id,
            contactId: contact.id,
         });

         await expect(repo.deleteContact(contact.id)).rejects.toThrow(
            /lançamentos vinculados/,
         );
      });

      it("rejects deleting a contact with bills", async () => {
         const teamId = randomTeamId();
         const contact = await repo.createContact(teamId, validCreateInput());

         await testDb.db.insert(bills).values({
            teamId,
            name: "Fatura",
            type: "payable",
            amount: "100.00",
            dueDate: "2026-02-01",
            contactId: contact.id,
         });

         await expect(repo.deleteContact(contact.id)).rejects.toThrow(
            /lançamentos vinculados/,
         );
      });
   });
});
```

**Step 2: Run the tests**

Run: `cd /home/yorizel/Documents/montte-nx && npx vitest run core/database/__tests__/repositories/contacts-repository.test.ts 2>&1 | tail -20`
Expected: All tests pass

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/contacts-repository.test.ts
git commit -m "test(database): add contacts repository tests"
```

---

### Task 4: Transactions schema validators

**Files:**

- Modify: `core/database/src/schemas/transactions.ts`

**Context:** Transactions schema has no Zod validators. Add `createTransactionSchema` and `updateTransactionSchema` with type-based validation (superRefine). Also change `contactId` onDelete from `set null` to `restrict`.

**Step 1: Add validators and change contactId onDelete**

Add to imports:

```typescript
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
```

Change contactId reference:

```typescript
contactId: uuid("contact_id").references(() => contacts.id, {
   onDelete: "restrict",
}),
```

Add after type exports:

```typescript
const numericPositive = (msg: string) =>
   z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: msg,
   });

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const baseTransactionSchema = createInsertSchema(transactions).pick({
   type: true,
   amount: true,
   description: true,
   date: true,
   bankAccountId: true,
   destinationBankAccountId: true,
   categoryId: true,
   creditCardId: true,
   contactId: true,
   paymentMethod: true,
   attachmentUrl: true,
   isInstallment: true,
   installmentCount: true,
   installmentNumber: true,
   installmentGroupId: true,
   statementPeriod: true,
});

export const createTransactionSchema = baseTransactionSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(200, "Nome deve ter no máximo 200 caracteres.")
         .nullable()
         .optional(),
      type: z.enum(["income", "expense", "transfer"], {
         required_error: "Tipo de lançamento é obrigatório.",
      }),
      amount: numericPositive(
         "Valor deve ser um número válido maior que zero.",
      ),
      date: dateSchema,
      description: z
         .string()
         .max(500, "Descrição deve ter no máximo 500 caracteres.")
         .nullable()
         .optional(),
      bankAccountId: z.string().uuid().nullable().optional(),
      destinationBankAccountId: z.string().uuid().nullable().optional(),
      creditCardId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      contactId: z.string().uuid().nullable().optional(),
      attachmentUrl: z.string().nullable().optional(),
   })
   .superRefine((data, ctx) => {
      if (data.type === "transfer") {
         if (!data.bankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Transferências exigem uma conta de origem.",
               path: ["bankAccountId"],
            });
         }
         if (!data.destinationBankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Transferências exigem uma conta de destino.",
               path: ["destinationBankAccountId"],
            });
         }
         if (
            data.bankAccountId &&
            data.destinationBankAccountId &&
            data.bankAccountId === data.destinationBankAccountId
         ) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Conta de origem e destino devem ser diferentes.",
               path: ["destinationBankAccountId"],
            });
         }
      }
      if (data.type === "expense") {
         if (!data.bankAccountId && !data.creditCardId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message:
                  "Despesas exigem uma conta bancária ou cartão de crédito.",
               path: ["bankAccountId"],
            });
         }
      }
      if (data.type === "income") {
         if (!data.bankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Receitas exigem uma conta bancária.",
               path: ["bankAccountId"],
            });
         }
      }
   });

export const updateTransactionSchema = baseTransactionSchema
   .omit({ type: true })
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(200, "Nome deve ter no máximo 200 caracteres.")
         .nullable()
         .optional(),
      amount: numericPositive(
         "Valor deve ser um número válido maior que zero.",
      ).optional(),
      date: dateSchema.optional(),
      description: z
         .string()
         .max(500, "Descrição deve ter no máximo 500 caracteres.")
         .nullable()
         .optional(),
      bankAccountId: z.string().uuid().nullable().optional(),
      destinationBankAccountId: z.string().uuid().nullable().optional(),
      creditCardId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      contactId: z.string().uuid().nullable().optional(),
      attachmentUrl: z.string().nullable().optional(),
   })
   .partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
```

**Step 2: Run typecheck**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 3: Commit**

```bash
git add core/database/src/schemas/transactions.ts
git commit -m "feat(database): add Zod validators to transactions schema"
```

---

### Task 5: Bills schema validators

**Files:**

- Modify: `core/database/src/schemas/bills.ts`

**Context:** Bills schema has no Zod validators. Add validators for bills and recurrence settings. Also make `contactId` a real FK to contacts with onDelete restrict.

**Step 1: Add FK import and validators**

Add to imports:

```typescript
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { contacts } from "./contacts";
```

Change `contactId` in bills table:

```typescript
contactId: uuid("contact_id").references(() => contacts.id, {
   onDelete: "restrict",
}),
```

Add after type exports:

```typescript
const numericPositive = (msg: string) =>
   z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: msg,
   });

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const baseBillSchema = createInsertSchema(bills).pick({
   name: true,
   description: true,
   type: true,
   amount: true,
   dueDate: true,
   bankAccountId: true,
   categoryId: true,
   contactId: true,
   attachmentUrl: true,
});

export const createBillSchema = baseBillSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(200, "Nome deve ter no máximo 200 caracteres."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   type: z.enum(["payable", "receivable"], {
      required_error: "Tipo é obrigatório.",
   }),
   amount: numericPositive("Valor deve ser um número válido maior que zero."),
   dueDate: dateSchema,
   bankAccountId: z.string().uuid().nullable().optional(),
   categoryId: z.string().uuid().nullable().optional(),
   contactId: z.string().uuid().nullable().optional(),
   attachmentUrl: z.string().nullable().optional(),
});

export const updateBillSchema = createBillSchema.partial();

const baseRecurrenceSchema = createInsertSchema(recurrenceSettings).pick({
   frequency: true,
   windowMonths: true,
   endsAt: true,
});

export const createRecurrenceSettingSchema = baseRecurrenceSchema.extend({
   frequency: z.enum(
      ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"],
      { required_error: "Frequência é obrigatória." },
   ),
   windowMonths: z
      .number()
      .int()
      .min(1, "Janela deve ser de no mínimo 1 mês.")
      .default(3),
   endsAt: dateSchema.nullable().optional(),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type CreateRecurrenceSettingInput = z.infer<
   typeof createRecurrenceSettingSchema
>;
```

**Step 2: Run typecheck**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 3: Commit**

```bash
git add core/database/src/schemas/bills.ts
git commit -m "feat(database): add Zod validators to bills schema and make contactId FK"
```

---

### Task 6: Transactions repository refactor

**Files:**

- Modify: `core/database/src/repositories/transactions-repository.ts`

**Context:** Refactor to singleton db, add `validateInput` with Zod, add `@f-o-t/money` for summary values. Keep all existing functions. The complex `listTransactions` with condition groups and weighted scoring must be preserved exactly as-is — only remove `db: DatabaseInstance` parameter and use singleton `db`.

**Step 1: Rewrite transactions-repository.ts**

Key changes:

- Replace `db: DatabaseInstance` param with `import { db } from "@core/database/client"`
- Add `validateInput` in `createTransaction` and `updateTransaction`
- Import schemas: `createTransactionSchema`, `updateTransactionSchema`
- Import types: `CreateTransactionInput`, `UpdateTransactionInput`
- Add `@f-o-t/money` in `getTransactionsSummary` for `incomeTotal`, `expenseTotal`, `balance`
- Change function signatures: remove first `db` param from all functions
- Keep `conditionToSql`, `ListTransactionsFilter`, weighted scoring, and all query logic exactly

Import changes at top:

```typescript
import type { Condition, ConditionGroup } from "@f-o-t/condition-evaluator";
import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { of, toDecimal } from "@f-o-t/money";
import {
   and,
   count,
   desc,
   eq,
   getTableColumns,
   gt,
   gte,
   ilike,
   inArray,
   isNotNull,
   isNull,
   lt,
   lte,
   ne,
   or,
   sql,
} from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateTransactionInput,
   type UpdateTransactionInput,
   bankAccounts,
   categories,
   contacts,
   creditCards,
   createTransactionSchema,
   updateTransactionSchema,
   transactionItems,
   transactions,
   transactionTags,
} from "../schema";
```

Function signature changes (remove `db: DatabaseInstance` first param from all):

- `createTransaction(data: CreateTransactionInput, tagIds?: string[])` — add `validateInput(createTransactionSchema, data)` before insert
- `listTransactions(filter: ListTransactionsFilter)` — no validation needed (filter interface)
- `getTransactionsSummary(filter: ListTransactionsFilter)` — wrap return values with `toDecimal(of(value, "BRL"))`
- `getTransactionWithTags(id: string)`
- `updateTransaction(id: string, data: UpdateTransactionInput, tagIds?: string[])` — add `validateInput(updateTransactionSchema, data)` before update
- `deleteTransaction(id: string)`
- `createTransactionItems(transactionId: string, teamId: string, items: ...)`
- `getTransactionItems(transactionId: string)`
- `replaceTransactionItems(transactionId: string, teamId: string, items: ...)`

For `getTransactionsSummary`, change the return to use `@f-o-t/money`:

```typescript
const currency = "BRL";
return {
   totalCount: result?.totalCount ?? 0,
   incomeTotal: toDecimal(of(result?.incomeTotal ?? "0", currency)),
   expenseTotal: toDecimal(of(result?.expenseTotal ?? "0", currency)),
   balance: toDecimal(of(result?.balance ?? "0", currency)),
};
```

For `createTransaction`, the `data` param type changes from `NewTransaction` to `CreateTransactionInput`. The function validates and then inserts with `teamId` from the validated data (note: `teamId` is NOT in the schema validator — it's added by the caller). So the signature should be:

```typescript
export async function createTransaction(
   teamId: string,
   data: CreateTransactionInput,
   tagIds?: string[],
) {
   const validated = validateInput(createTransactionSchema, data);
   try {
      const [transaction] = await db
         .insert(transactions)
         .values({ ...validated, teamId })
         .returning();
      // ... tag insertion same as before
   }
}
```

For `updateTransaction`:

```typescript
export async function updateTransaction(
   id: string,
   data: UpdateTransactionInput,
   tagIds?: string[],
) {
   const validated = validateInput(updateTransactionSchema, data);
   // ... rest same but using validated
}
```

For `replaceTransactionItems`, since it calls `createTransactionItems` internally, just update the internal call (no `db` param).

**Step 2: Run typecheck**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 3: Commit**

```bash
git add core/database/src/repositories/transactions-repository.ts
git commit -m "refactor(database): rewrite transactions repository with singleton db pattern"
```

---

### Task 7: Bills repository refactor

**Files:**

- Modify: `core/database/src/repositories/bills-repository.ts`

**Context:** Refactor to singleton db, add `validateInput` with Zod, add `@f-o-t/money` for amount. Keep all existing functions. Follow the same pattern as transactions repository refactor.

**Step 1: Rewrite bills-repository.ts**

Import changes:

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateBillInput,
   type UpdateBillInput,
   type CreateRecurrenceSettingInput,
   type Bill,
   type RecurrenceSetting,
   bills,
   recurrenceSettings,
   createBillSchema,
   updateBillSchema,
   createRecurrenceSettingSchema,
} from "@core/database/schemas/bills";
```

Function signature changes (remove `db: DatabaseInstance` first param from all):

- `createBill(teamId: string, data: CreateBillInput)` — add `validateInput(createBillSchema, data)`, then `{ ...validated, teamId }`
- `createBillsBatch(teamId: string, data: CreateBillInput[])` — validate each item, add teamId
- `createRecurrenceSetting(teamId: string, data: CreateRecurrenceSettingInput)` — validate, add teamId
- `listBills(options: ListBillsOptions)` — no change to logic
- `getBill(id: string)`
- `updateBill(id: string, data: UpdateBillInput)` — validate
- `deleteBill(id: string)`
- `getActiveRecurrenceSettings()` — no params
- `getLastBillForRecurrenceGroup(recurrenceGroupId: string)`

**Important:** `createBillsBatch` is called by routers/workers that already have `teamId` in the data. The new signature should accept pre-formed data arrays since batch items come from router logic with computed dueDates, installment info, etc. Two options:

Option A: Keep batch accepting raw `NewBill[]` without validation (batch items are already computed/validated by the caller).
Option B: Validate each item.

Go with **Option A** for batch — the caller (router) validates the base bill input, then computes installment/recurrence data. The batch function just inserts. Individual `createBill` validates.

```typescript
export async function createBill(
   teamId: string,
   data: CreateBillInput,
): Promise<Bill> {
   const validated = validateInput(createBillSchema, data);
   try {
      const [bill] = await db
         .insert(bills)
         .values({ ...validated, teamId })
         .returning();
      if (!bill) throw AppError.database("Failed to create bill");
      return bill;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bill");
   }
}

export async function createBillsBatch(data: NewBill[]): Promise<Bill[]> {
   try {
      return await db.insert(bills).values(data).returning();
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bills batch");
   }
}

export async function createRecurrenceSetting(
   teamId: string,
   data: CreateRecurrenceSettingInput,
): Promise<RecurrenceSetting> {
   const validated = validateInput(createRecurrenceSettingSchema, data);
   try {
      const [setting] = await db
         .insert(recurrenceSettings)
         .values({ ...validated, teamId })
         .returning();
      if (!setting)
         throw AppError.database("Failed to create recurrence setting");
      return setting;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create recurrence setting");
   }
}
```

**Step 2: Run typecheck**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 3: Commit**

```bash
git add core/database/src/repositories/bills-repository.ts
git commit -m "refactor(database): rewrite bills repository with singleton db pattern"
```

---

### Task 8: Update consumers (routers + workers)

**Files:**

- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`
- Modify: `apps/web/src/integrations/orpc/router/bills.ts`
- Modify: `apps/web/src/integrations/orpc/router/contacts.ts`
- Modify: `apps/web/src/integrations/orpc/router/inventory.ts`
- Modify: `apps/worker/src/jobs/generate-bill-occurrences.ts`

**Context:** All consumers currently pass `db` as first argument to repository functions. Remove the `db` argument from all calls. Some function signatures also changed (e.g., `createTransaction` now takes `teamId` as first arg, `createBill` takes `teamId` as first arg, etc.).

**Step 1: Update transactions router**

Key changes in `apps/web/src/integrations/orpc/router/transactions.ts`:

- `createTransaction(db, {...data, teamId}, tagIds)` → `createTransaction(teamId, data, tagIds)`
- `listTransactions(db, { teamId, ...input })` → `listTransactions({ teamId, ...input })`
- `getTransactionsSummary(db, { teamId, ...input })` → `getTransactionsSummary({ teamId, ...input })`
- `getTransactionWithTags(db, input.id)` → `getTransactionWithTags(input.id)`
- `updateTransaction(db, id, data, tagIds)` → `updateTransaction(id, data, tagIds)`
- `deleteTransaction(db, input.id)` → `deleteTransaction(input.id)`
- `createTransactionItems(db, transaction.id, teamId, items)` → `createTransactionItems(transaction.id, teamId, items)`
- `replaceTransactionItems(db, id, teamId, items)` → `replaceTransactionItems(id, teamId, items)`
- `verifyTransactionRefs`: update `getBankAccount(db, ...)` → `getBankAccount(...)`, `getContact(db, ...)` → `getContact(...)`
- Remove `const { db, teamId } = context` — just `const { teamId } = context` (db no longer needed from context for repos)

**Step 2: Update bills router**

Key changes in `apps/web/src/integrations/orpc/router/bills.ts`:

- `createBill(db, { ...bill, teamId })` → `createBill(teamId, bill)`
- `createBillsBatch(db, batchData)` → `createBillsBatch(batchData)` (batch data already has teamId)
- `createRecurrenceSetting(db, { teamId, ... })` → `createRecurrenceSetting(teamId, { ... })`
- `listBills(db, { teamId, ...input })` → `listBills({ teamId, ...input })`
- `getBill(db, id)` → `getBill(id)`
- `updateBill(db, id, data)` → `updateBill(id, data)`
- `deleteBill(db, id)` → `deleteBill(id)`
- `createTransaction(db, {...}, [])` → `createTransaction(teamId, {...}, [])`
- `deleteTransaction(db, bill.transactionId)` → `deleteTransaction(bill.transactionId)`
- `verifyBillRefs`: update `getBankAccount(db, ...)` → `getBankAccount(...)`

**Step 3: Update contacts router**

Key changes in `apps/web/src/integrations/orpc/router/contacts.ts`:

- `createContact(db, { ...input, teamId })` → `createContact(teamId, input)`
- `listContacts(db, teamId, input?.type)` → `listContacts(teamId, input?.type)`
- `getContact(db, input.id)` → `getContact(input.id)`
- `updateContact(db, id, data)` → `updateContact(id, data)`
- `deleteContact(db, input.id)` → `deleteContact(input.id)`
- `contactHasTransactions(db, input.id)` → `contactHasLinks(input.id)` (function renamed)
- Remove `contactHasTransactions` import, add `contactHasLinks` import (or just rely on `deleteContact` which now checks internally)

**Step 4: Update inventory router**

In `apps/web/src/integrations/orpc/router/inventory.ts`:

- `createTransaction(db, ...)` → `createTransaction(teamId, ...)`

**Step 5: Update bill occurrences worker**

In `apps/worker/src/jobs/generate-bill-occurrences.ts`:

- `getActiveRecurrenceSettings(db)` → `getActiveRecurrenceSettings()`
- `getLastBillForRecurrenceGroup(db, setting.id)` → `getLastBillForRecurrenceGroup(setting.id)`
- `createBillsBatch(db, toCreate)` → `createBillsBatch(toCreate)`
- Remove `db: DatabaseInstance` parameter from `generateBillOccurrences`

**Step 6: Run typecheck**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 7: Commit**

```bash
git add apps/web/src/integrations/orpc/router/transactions.ts apps/web/src/integrations/orpc/router/bills.ts apps/web/src/integrations/orpc/router/contacts.ts apps/web/src/integrations/orpc/router/inventory.ts apps/worker/src/jobs/generate-bill-occurrences.ts
git commit -m "refactor(database): update consumers to new repository signatures"
```

---

### Task 9: Credit card statements repository update

**Files:**

- Modify: `core/database/src/repositories/credit-card-statements-repository.ts`

**Context:** This repository already uses singleton `db` import. However, it directly inserts into `bills` and `transactions` tables inline (in `getOrCreateStatement` and `payStatement`). These direct inserts should remain as-is (they use `tx` inside transactions). No functional changes needed — just verify it compiles with the updated schema (bills.contactId FK change).

**Step 1: Verify typecheck passes**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

If there are errors related to the FK changes, fix them. Otherwise, no changes needed.

**Step 2: Commit (only if changes were needed)**

```bash
git add core/database/src/repositories/credit-card-statements-repository.ts
git commit -m "fix(database): update credit card statements for schema changes"
```

---

### Task 10: Transactions repository tests

**Files:**

- Create: `core/database/__tests__/repositories/transactions-repository.test.ts`

**Context:** Test the refactored transactions repository. Follow the same patterns as `bank-accounts-repository.test.ts`. Need to create bank accounts as FK dependencies for transactions.

**Step 1: Write transactions-repository.test.ts**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { creditCards } from "@core/database/schemas/credit-cards";
import * as repo from "../../src/repositories/transactions-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

async function createTestBankAccount(teamId: string, name = "Conta Teste") {
   const [account] = await testDb.db
      .insert(bankAccounts)
      .values({ teamId, name, type: "checking", initialBalance: "1000.00" })
      .returning();
   return account!;
}

async function createTestCategory(
   teamId: string,
   type: "income" | "expense" = "expense",
) {
   const [category] = await testDb.db
      .insert(categories)
      .values({ teamId, name: `Cat-${crypto.randomUUID().slice(0, 8)}`, type })
      .returning();
   return category!;
}

async function createTestCreditCard(teamId: string, bankAccountId: string) {
   const [card] = await testDb.db
      .insert(creditCards)
      .values({
         teamId,
         name: "Cartão Teste",
         closingDay: 25,
         dueDay: 5,
         bankAccountId,
         creditLimit: "5000.00",
      })
      .returning();
   return card!;
}

async function createTestTag(teamId: string) {
   const [tag] = await testDb.db
      .insert(tags)
      .values({ teamId, name: `Tag-${crypto.randomUUID().slice(0, 8)}` })
      .returning();
   return tag!;
}

describe("transactions-repository", () => {
   describe("validators", () => {
      it("rejects amount <= 0", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         await expect(
            repo.createTransaction(teamId, {
               type: "income",
               amount: "0",
               date: "2026-01-15",
               bankAccountId: account.id,
            }),
         ).rejects.toThrow(/maior que zero/);
      });

      it("rejects invalid date format", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         await expect(
            repo.createTransaction(teamId, {
               type: "income",
               amount: "100.00",
               date: "15/01/2026",
               bankAccountId: account.id,
            }),
         ).rejects.toThrow(/YYYY-MM-DD/);
      });

      it("rejects transfer without origin account", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         await expect(
            repo.createTransaction(teamId, {
               type: "transfer",
               amount: "100.00",
               date: "2026-01-15",
               destinationBankAccountId: account.id,
            }),
         ).rejects.toThrow(/conta de origem/);
      });

      it("rejects transfer without destination account", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         await expect(
            repo.createTransaction(teamId, {
               type: "transfer",
               amount: "100.00",
               date: "2026-01-15",
               bankAccountId: account.id,
            }),
         ).rejects.toThrow(/conta de destino/);
      });

      it("rejects transfer with same origin and destination", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         await expect(
            repo.createTransaction(teamId, {
               type: "transfer",
               amount: "100.00",
               date: "2026-01-15",
               bankAccountId: account.id,
               destinationBankAccountId: account.id,
            }),
         ).rejects.toThrow(/diferentes/);
      });

      it("rejects expense without bank account or credit card", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createTransaction(teamId, {
               type: "expense",
               amount: "100.00",
               date: "2026-01-15",
            }),
         ).rejects.toThrow(/conta bancária ou cartão/);
      });

      it("rejects income without bank account", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createTransaction(teamId, {
               type: "income",
               amount: "100.00",
               date: "2026-01-15",
            }),
         ).rejects.toThrow(/conta bancária/);
      });
   });

   describe("createTransaction", () => {
      it("creates an income transaction", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const tx = await repo.createTransaction(teamId, {
            type: "income",
            amount: "500.00",
            date: "2026-01-15",
            bankAccountId: account.id,
            name: "Salário",
         });

         expect(tx).toMatchObject({
            teamId,
            type: "income",
            amount: "500.00",
            name: "Salário",
         });
         expect(tx.id).toBeDefined();
      });

      it("creates a transfer transaction", async () => {
         const teamId = randomTeamId();
         const origin = await createTestBankAccount(teamId, "Origem");
         const dest = await createTestBankAccount(teamId, "Destino");

         const tx = await repo.createTransaction(teamId, {
            type: "transfer",
            amount: "200.00",
            date: "2026-01-15",
            bankAccountId: origin.id,
            destinationBankAccountId: dest.id,
         });

         expect(tx.type).toBe("transfer");
         expect(tx.bankAccountId).toBe(origin.id);
         expect(tx.destinationBankAccountId).toBe(dest.id);
      });

      it("creates expense with credit card", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const card = await createTestCreditCard(teamId, account.id);

         const tx = await repo.createTransaction(teamId, {
            type: "expense",
            amount: "150.00",
            date: "2026-01-15",
            creditCardId: card.id,
         });

         expect(tx.creditCardId).toBe(card.id);
      });

      it("creates transaction with tags", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const tag = await createTestTag(teamId);

         const tx = await repo.createTransaction(
            teamId,
            {
               type: "income",
               amount: "100.00",
               date: "2026-01-15",
               bankAccountId: account.id,
            },
            [tag.id],
         );

         const withTags = await repo.getTransactionWithTags(tx.id);
         expect(withTags?.tagIds).toContain(tag.id);
      });
   });

   describe("listTransactions", () => {
      it("lists transactions by teamId", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         await repo.createTransaction(teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });

         const { data, total } = await repo.listTransactions({ teamId });
         expect(total).toBe(1);
         expect(data).toHaveLength(1);
      });

      it("filters by type", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         await repo.createTransaction(teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         await repo.createTransaction(teamId, {
            type: "expense",
            amount: "50.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });

         const { total } = await repo.listTransactions({
            teamId,
            type: "income",
         });
         expect(total).toBe(1);
      });

      it("filters by date range", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         await repo.createTransaction(teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         await repo.createTransaction(teamId, {
            type: "income",
            amount: "200.00",
            date: "2026-02-15",
            bankAccountId: account.id,
         });

         const { total } = await repo.listTransactions({
            teamId,
            dateFrom: "2026-02-01",
            dateTo: "2026-02-28",
         });
         expect(total).toBe(1);
      });
   });

   describe("getTransactionsSummary", () => {
      it("computes income, expense, and balance totals", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         await repo.createTransaction(teamId, {
            type: "income",
            amount: "1000.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         await repo.createTransaction(teamId, {
            type: "expense",
            amount: "300.00",
            date: "2026-01-16",
            bankAccountId: account.id,
         });

         const summary = await repo.getTransactionsSummary({ teamId });
         expect(summary.totalCount).toBe(2);
         expect(summary.incomeTotal).toBe("1000.00");
         expect(summary.expenseTotal).toBe("300.00");
         expect(summary.balance).toBe("700.00");
      });
   });

   describe("updateTransaction", () => {
      it("updates a transaction", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const tx = await repo.createTransaction(teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
            name: "Original",
         });

         const updated = await repo.updateTransaction(tx.id, {
            name: "Updated",
         });
         expect(updated.name).toBe("Updated");
      });

      it("updates tags", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const tag1 = await createTestTag(teamId);
         const tag2 = await createTestTag(teamId);

         const tx = await repo.createTransaction(
            teamId,
            {
               type: "income",
               amount: "100.00",
               date: "2026-01-15",
               bankAccountId: account.id,
            },
            [tag1.id],
         );

         await repo.updateTransaction(tx.id, {}, [tag2.id]);

         const withTags = await repo.getTransactionWithTags(tx.id);
         expect(withTags?.tagIds).toEqual([tag2.id]);
      });
   });

   describe("deleteTransaction", () => {
      it("deletes a transaction", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const tx = await repo.createTransaction(teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });

         await repo.deleteTransaction(tx.id);
         const found = await repo.getTransactionWithTags(tx.id);
         expect(found).toBeNull();
      });
   });

   describe("transaction items", () => {
      it("creates and retrieves items", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const tx = await repo.createTransaction(teamId, {
            type: "expense",
            amount: "200.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });

         await repo.createTransactionItems(tx.id, teamId, [
            { description: "Item 1", quantity: "2", unitPrice: "50.00" },
            { description: "Item 2", quantity: "1", unitPrice: "100.00" },
         ]);

         const items = await repo.getTransactionItems(tx.id);
         expect(items).toHaveLength(2);
      });

      it("replaces items", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const tx = await repo.createTransaction(teamId, {
            type: "expense",
            amount: "200.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });

         await repo.createTransactionItems(tx.id, teamId, [
            { description: "Old", quantity: "1", unitPrice: "200.00" },
         ]);

         await repo.replaceTransactionItems(tx.id, teamId, [
            { description: "New 1", quantity: "1", unitPrice: "100.00" },
            { description: "New 2", quantity: "1", unitPrice: "100.00" },
         ]);

         const items = await repo.getTransactionItems(tx.id);
         expect(items).toHaveLength(2);
         expect(items[0]!.description).toBe("New 1");
      });
   });
});
```

**Step 2: Run the tests**

Run: `cd /home/yorizel/Documents/montte-nx && npx vitest run core/database/__tests__/repositories/transactions-repository.test.ts 2>&1 | tail -20`
Expected: All tests pass

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/transactions-repository.test.ts
git commit -m "test(database): add transactions repository tests"
```

---

### Task 11: Bills repository tests

**Files:**

- Create: `core/database/__tests__/repositories/bills-repository.test.ts`

**Context:** Test the refactored bills repository. Need bank accounts and categories as FK dependencies. Also test recurrence settings and batch creation.

**Step 1: Write bills-repository.test.ts**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { contacts } from "@core/database/schemas/contacts";
import { categories } from "@core/database/schemas/categories";
import * as repo from "../../src/repositories/bills-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

function validCreateInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Aluguel",
      type: "payable" as const,
      amount: "1500.00",
      dueDate: "2026-02-01",
      ...overrides,
   };
}

describe("bills-repository", () => {
   describe("validators", () => {
      it("rejects amount <= 0", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createBill(teamId, validCreateInput({ amount: "0" })),
         ).rejects.toThrow(/maior que zero/);
      });

      it("rejects invalid dueDate format", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createBill(
               teamId,
               validCreateInput({ dueDate: "01/02/2026" }),
            ),
         ).rejects.toThrow(/YYYY-MM-DD/);
      });

      it("rejects name shorter than 2 characters", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createBill(teamId, validCreateInput({ name: "A" })),
         ).rejects.toThrow(/mínimo 2/);
      });

      it("rejects missing type", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createBill(teamId, {
               ...validCreateInput(),
               type: undefined,
            } as any),
         ).rejects.toThrow();
      });
   });

   describe("createBill", () => {
      it("creates a bill and returns it", async () => {
         const teamId = randomTeamId();
         const bill = await repo.createBill(teamId, validCreateInput());

         expect(bill).toMatchObject({
            teamId,
            name: "Aluguel",
            type: "payable",
            status: "pending",
            amount: "1500.00",
         });
         expect(bill.id).toBeDefined();
      });

      it("creates a bill with contactId FK", async () => {
         const teamId = randomTeamId();
         const [contact] = await testDb.db
            .insert(contacts)
            .values({ teamId, name: "Landlord", type: "fornecedor" })
            .returning();

         const bill = await repo.createBill(
            teamId,
            validCreateInput({ contactId: contact!.id }),
         );

         expect(bill.contactId).toBe(contact!.id);
      });
   });

   describe("listBills", () => {
      it("lists bills by teamId", async () => {
         const teamId = randomTeamId();
         await repo.createBill(teamId, validCreateInput());

         const { items, total } = await repo.listBills({ teamId });
         expect(total).toBe(1);
         expect(items).toHaveLength(1);
      });

      it("filters by type", async () => {
         const teamId = randomTeamId();
         await repo.createBill(teamId, validCreateInput({ type: "payable" }));
         await repo.createBill(
            teamId,
            validCreateInput({ name: "Receita", type: "receivable" }),
         );

         const { total } = await repo.listBills({ teamId, type: "receivable" });
         expect(total).toBe(1);
      });

      it("filters by status", async () => {
         const teamId = randomTeamId();
         await repo.createBill(
            teamId,
            validCreateInput({ dueDate: "2099-01-01" }),
         );
         await repo.createBill(
            teamId,
            validCreateInput({ name: "Pago", dueDate: "2099-02-01" }),
         );

         const { total } = await repo.listBills({
            teamId,
            status: "pending",
         });
         expect(total).toBe(2);
      });
   });

   describe("getBill", () => {
      it("returns bill by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBill(teamId, validCreateInput());

         const found = await repo.getBill(created.id);
         expect(found).toBeDefined();
         expect(found?.name).toBe("Aluguel");
      });

      it("returns undefined for non-existent id", async () => {
         const found = await repo.getBill(crypto.randomUUID());
         expect(found).toBeUndefined();
      });
   });

   describe("updateBill", () => {
      it("updates a bill", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBill(teamId, validCreateInput());

         const updated = await repo.updateBill(created.id, {
            name: "Aluguel Atualizado",
         });
         expect(updated.name).toBe("Aluguel Atualizado");
      });
   });

   describe("deleteBill", () => {
      it("deletes a bill", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBill(teamId, validCreateInput());

         await repo.deleteBill(created.id);
         const found = await repo.getBill(created.id);
         expect(found).toBeUndefined();
      });
   });

   describe("createBillsBatch", () => {
      it("creates multiple bills at once", async () => {
         const teamId = randomTeamId();
         const batch = [
            {
               teamId,
               name: "Parcela 1/3",
               type: "payable" as const,
               amount: "500.00",
               dueDate: "2026-01-01",
               status: "pending" as const,
            },
            {
               teamId,
               name: "Parcela 2/3",
               type: "payable" as const,
               amount: "500.00",
               dueDate: "2026-02-01",
               status: "pending" as const,
            },
            {
               teamId,
               name: "Parcela 3/3",
               type: "payable" as const,
               amount: "500.00",
               dueDate: "2026-03-01",
               status: "pending" as const,
            },
         ];

         const result = await repo.createBillsBatch(batch);
         expect(result).toHaveLength(3);
      });
   });

   describe("recurrence", () => {
      it("creates a recurrence setting", async () => {
         const teamId = randomTeamId();
         const setting = await repo.createRecurrenceSetting(teamId, {
            frequency: "monthly",
            windowMonths: 3,
         });

         expect(setting).toMatchObject({
            teamId,
            frequency: "monthly",
            windowMonths: 3,
         });
         expect(setting.id).toBeDefined();
      });

      it("gets active recurrence settings", async () => {
         const teamId = randomTeamId();
         await repo.createRecurrenceSetting(teamId, {
            frequency: "monthly",
            windowMonths: 3,
         });

         const settings = await repo.getActiveRecurrenceSettings();
         expect(settings.length).toBeGreaterThanOrEqual(1);
      });

      it("gets last bill for recurrence group", async () => {
         const teamId = randomTeamId();
         const setting = await repo.createRecurrenceSetting(teamId, {
            frequency: "monthly",
            windowMonths: 3,
         });

         const batch = [
            {
               teamId,
               name: "Recorrente",
               type: "payable" as const,
               amount: "100.00",
               dueDate: "2026-01-01",
               status: "pending" as const,
               recurrenceGroupId: setting.id,
            },
            {
               teamId,
               name: "Recorrente",
               type: "payable" as const,
               amount: "100.00",
               dueDate: "2026-02-01",
               status: "pending" as const,
               recurrenceGroupId: setting.id,
            },
         ];
         await repo.createBillsBatch(batch);

         const last = await repo.getLastBillForRecurrenceGroup(setting.id);
         expect(last?.dueDate).toBe("2026-02-01");
      });
   });

   describe("contactId FK restrict", () => {
      it("prevents deleting contact linked to a bill", async () => {
         const teamId = randomTeamId();
         const [contact] = await testDb.db
            .insert(contacts)
            .values({ teamId, name: "Fornecedor", type: "fornecedor" })
            .returning();

         await repo.createBill(
            teamId,
            validCreateInput({ contactId: contact!.id }),
         );

         await expect(
            testDb.db
               .delete(contacts)
               .where(
                  (await import("drizzle-orm")).eq(contacts.id, contact!.id),
               ),
         ).rejects.toThrow();
      });
   });
});
```

**Step 2: Run the tests**

Run: `cd /home/yorizel/Documents/montte-nx && npx vitest run core/database/__tests__/repositories/bills-repository.test.ts 2>&1 | tail -20`
Expected: All tests pass

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/bills-repository.test.ts
git commit -m "test(database): add bills repository tests"
```

---

### Task 12: Run all tests and verify

**Files:** None (verification only)

**Step 1: Run all database tests**

Run: `cd /home/yorizel/Documents/montte-nx && npx vitest run core/database/__tests__/ 2>&1 | tail -30`
Expected: All tests pass

**Step 2: Run full typecheck**

Run: `cd /home/yorizel/Documents/montte-nx && bunx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`
Expected: No errors

**Step 3: Run format check**

Run: `cd /home/yorizel/Documents/montte-nx && bun run format:check 2>&1 | tail -10`
Expected: No formatting issues (or fix and commit)
