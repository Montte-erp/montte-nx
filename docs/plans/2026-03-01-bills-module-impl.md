# Bills Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a bills module (contas a pagar/receber) with installment plans, recurring schedules, and transaction integration.

**Architecture:** Bills are separate entities from transactions. Paying a bill auto-creates a transaction. Bills can be installment-based (fixed count, flexible split) or recurring (rolling window, user-configured horizon). The design doc is at `docs/plans/2026-03-01-bills-module.md`.

**Tech Stack:** Drizzle ORM + PostgreSQL, oRPC, TanStack Query, BullMQ, node-cron, React + Tailwind, @tanstack/react-form, DataTable from `@packages/ui`

---

## Task 1: Database Schema — bills + recurrenceSettings

**Files:**

- Create: `packages/database/src/schemas/bills.ts`
- Modify: `packages/database/src/schema.ts`

**Step 1: Create the schema file**

```typescript
// packages/database/src/schemas/bills.ts
import { relations, sql } from "drizzle-orm";
import {
   date,
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
import { categories } from "./categories";
import { transactions } from "./transactions";

export const billTypeEnum = pgEnum("bill_type", ["payable", "receivable"]);

export const billStatusEnum = pgEnum("bill_status", [
   "pending",
   "paid",
   "cancelled",
]);

export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
   "weekly",
   "biweekly",
   "monthly",
   "quarterly",
   "yearly",
]);

export const recurrenceSettings = pgTable("recurrence_settings", {
   id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
   teamId: uuid("team_id").notNull(),
   frequency: recurrenceFrequencyEnum("frequency").notNull(),
   windowMonths: integer("window_months").notNull().default(3),
   endsAt: date("ends_at"),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
});

export const bills = pgTable(
   "bills",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      type: billTypeEnum("type").notNull(),
      status: billStatusEnum("status").notNull().default("pending"),
      amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
      dueDate: date("due_date").notNull(),
      paidAt: timestamp("paid_at", { withTimezone: true }),
      bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
         onDelete: "set null",
      }),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "set null",
      }),
      attachmentUrl: text("attachment_url"),
      // Installment fields (null if not installment-based)
      installmentGroupId: uuid("installment_group_id"),
      installmentIndex: integer("installment_index"),
      installmentTotal: integer("installment_total"),
      // Recurrence fields (null if not recurring)
      recurrenceGroupId: uuid("recurrence_group_id").references(
         () => recurrenceSettings.id,
         { onDelete: "cascade" },
      ),
      // Link to generated transaction when paid
      transactionId: uuid("transaction_id").references(() => transactions.id, {
         onDelete: "set null",
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("bills_team_id_idx").on(table.teamId),
      index("bills_due_date_idx").on(table.dueDate),
      index("bills_status_idx").on(table.status),
      index("bills_installment_group_idx").on(table.installmentGroupId),
      index("bills_recurrence_group_idx").on(table.recurrenceGroupId),
   ],
);

export const billsRelations = relations(bills, ({ one }) => ({
   bankAccount: one(bankAccounts, {
      fields: [bills.bankAccountId],
      references: [bankAccounts.id],
   }),
   category: one(categories, {
      fields: [bills.categoryId],
      references: [categories.id],
   }),
   transaction: one(transactions, {
      fields: [bills.transactionId],
      references: [transactions.id],
   }),
   recurrenceSetting: one(recurrenceSettings, {
      fields: [bills.recurrenceGroupId],
      references: [recurrenceSettings.id],
   }),
}));

export const recurrenceSettingsRelations = relations(
   recurrenceSettings,
   ({ many }) => ({
      bills: many(bills),
   }),
);

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillType = (typeof billTypeEnum.enumValues)[number];
export type BillStatus = (typeof billStatusEnum.enumValues)[number];
export type RecurrenceFrequency =
   (typeof recurrenceFrequencyEnum.enumValues)[number];
export type RecurrenceSetting = typeof recurrenceSettings.$inferSelect;
export type NewRecurrenceSetting = typeof recurrenceSettings.$inferInsert;
```

**Step 2: Export from schema barrel**

In `packages/database/src/schema.ts`, find the `// Finance` section and add:

```typescript
export * from "./schemas/bills";
```

Add it after `export * from "./schemas/bank-accounts";`.

**Step 3: Verify TypeScript compiles**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -40
```

Expected: no errors in the new file.

**Step 4: Ask the user to push the schema**

⚠️ STOP HERE — tell the user: "Schema files created. Please run `bun run db:push` to apply the schema changes to the database, then let me know when done."

**Step 5: Commit**

```bash
git add packages/database/src/schemas/bills.ts packages/database/src/schema.ts
git commit -m "feat(database): add bills and recurrence_settings schema"
```

---

## Task 2: Database Repository — bills

**Files:**

- Create: `packages/database/src/repositories/bills-repository.ts`

**Step 1: Create the repository**

```typescript
// packages/database/src/repositories/bills-repository.ts
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { AppError, propagateError } from "@packages/utils/errors";
import { bills, recurrenceSettings } from "../schemas/bills";
import type { Bill, NewBill, NewRecurrenceSetting } from "../schemas/bills";

export async function createBill(
   db: DatabaseInstance,
   data: NewBill,
): Promise<Bill> {
   try {
      const result = await db.insert(bills).values(data).returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bill");
   }
}

export async function createBillsBatch(
   db: DatabaseInstance,
   data: NewBill[],
): Promise<Bill[]> {
   try {
      return await db.insert(bills).values(data).returning();
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bills batch");
   }
}

export async function createRecurrenceSetting(
   db: DatabaseInstance,
   data: NewRecurrenceSetting,
): Promise<typeof recurrenceSettings.$inferSelect> {
   try {
      const result = await db
         .insert(recurrenceSettings)
         .values(data)
         .returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create recurrence setting");
   }
}

export interface ListBillsOptions {
   teamId: string;
   type?: "payable" | "receivable";
   status?: "pending" | "paid" | "cancelled" | "overdue";
   categoryId?: string;
   month?: number;
   year?: number;
   page?: number;
   pageSize?: number;
}

// NOTE: "overdue" is not stored — it is computed: pending + dueDate < today
export async function listBills(
   db: DatabaseInstance,
   options: ListBillsOptions,
) {
   try {
      const {
         teamId,
         type,
         status,
         categoryId,
         month,
         year,
         page = 1,
         pageSize = 20,
      } = options;

      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      const conditions = [eq(bills.teamId, teamId)];

      if (type) conditions.push(eq(bills.type, type));

      if (status === "overdue") {
         conditions.push(eq(bills.status, "pending"));
         conditions.push(lte(bills.dueDate, today));
      } else if (status === "pending") {
         conditions.push(eq(bills.status, "pending"));
         conditions.push(gte(bills.dueDate, today));
      } else if (status) {
         conditions.push(eq(bills.status, status));
      }

      if (categoryId) conditions.push(eq(bills.categoryId, categoryId));

      if (month && year) {
         const start = `${year}-${String(month).padStart(2, "0")}-01`;
         const end = new Date(year, month, 0).toISOString().split("T")[0];
         conditions.push(gte(bills.dueDate, start));
         conditions.push(lte(bills.dueDate, end));
      }

      const offset = (page - 1) * pageSize;

      const rows = await db.query.bills.findMany({
         where: and(...conditions),
         with: { bankAccount: true, category: true },
         orderBy: [desc(bills.dueDate)],
         limit: pageSize,
         offset,
      });

      const [{ count }] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(bills)
         .where(and(...conditions));

      return { items: rows, total: count, page, pageSize };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bills");
   }
}

export async function getBill(
   db: DatabaseInstance,
   id: string,
): Promise<Bill | undefined> {
   try {
      const result = await db.query.bills.findFirst({
         where: eq(bills.id, id),
         with: { bankAccount: true, category: true, transaction: true },
      });
      return result ?? undefined;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get bill");
   }
}

export async function updateBill(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewBill>,
): Promise<Bill> {
   try {
      const result = await db
         .update(bills)
         .set({ ...data, updatedAt: new Date() })
         .where(eq(bills.id, id))
         .returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update bill");
   }
}

export async function deleteBill(
   db: DatabaseInstance,
   id: string,
): Promise<void> {
   try {
      await db.delete(bills).where(eq(bills.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete bill");
   }
}

export async function getActiveRecurrenceSettings(
   db: DatabaseInstance,
): Promise<(typeof recurrenceSettings.$inferSelect)[]> {
   try {
      const today = new Date().toISOString().split("T")[0];
      return await db.query.recurrenceSettings.findMany({
         where: and(
            // No end date, or end date is in the future
            sql`(${recurrenceSettings.endsAt} IS NULL OR ${recurrenceSettings.endsAt} >= ${today})`,
         ),
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get recurrence settings");
   }
}

export async function getLastBillForRecurrenceGroup(
   db: DatabaseInstance,
   recurrenceGroupId: string,
): Promise<Bill | undefined> {
   try {
      const result = await db.query.bills.findFirst({
         where: eq(bills.recurrenceGroupId, recurrenceGroupId),
         orderBy: [desc(bills.dueDate)],
      });
      return result ?? undefined;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get last bill for recurrence group");
   }
}
```

**Step 2: Verify TypeScript compiles**

```bash
bun run typecheck 2>&1 | head -40
```

Expected: no errors.

**Step 3: Commit**

```bash
git add packages/database/src/repositories/bills-repository.ts
git commit -m "feat(database): add bills repository with list/create/update/delete"
```

---

## Task 3: oRPC Router — bills

**Files:**

- Create: `apps/web/src/integrations/orpc/router/bills.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Create the router**

```typescript
// apps/web/src/integrations/orpc/router/bills.ts
import { ORPCError } from "@orpc/server";
import {
   createBill,
   createBillsBatch,
   createRecurrenceSetting,
   deleteBill,
   getBill,
   listBills,
   updateBill,
} from "@packages/database/repositories/bills-repository";
import { getBankAccount } from "@packages/database/repositories/bank-accounts-repository";
import { getCategory } from "@packages/database/repositories/categories-repository";
import { createTransaction } from "@packages/database/repositories/transactions-repository";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Helpers
// =============================================================================

function computeDueDate(
   startDate: string,
   frequency: string,
   offset: number,
): string {
   const d = new Date(startDate);
   switch (frequency) {
      case "weekly":
         d.setDate(d.getDate() + 7 * offset);
         break;
      case "biweekly":
         d.setDate(d.getDate() + 14 * offset);
         break;
      case "monthly":
         d.setMonth(d.getMonth() + offset);
         break;
      case "quarterly":
         d.setMonth(d.getMonth() + 3 * offset);
         break;
      case "yearly":
         d.setFullYear(d.getFullYear() + offset);
         break;
   }
   return d.toISOString().split("T")[0];
}

async function verifyBillRefs(
   db: Parameters<typeof getBankAccount>[0],
   teamId: string,
   input: { bankAccountId?: string | null; categoryId?: string | null },
) {
   if (input.bankAccountId) {
      const account = await getBankAccount(db, input.bankAccountId);
      if (!account || account.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Conta bancária inválida.",
         });
      }
   }
   if (input.categoryId) {
      const cat = await getCategory(db, input.categoryId);
      if (!cat || cat.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", { message: "Categoria inválida." });
      }
   }
}

// =============================================================================
// Input schemas
// =============================================================================

const billBaseSchema = z.object({
   name: z.string().min(1).max(200),
   description: z.string().nullable().optional(),
   type: z.enum(["payable", "receivable"]),
   amount: z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Valor deve ser maior que zero.",
   }),
   dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
   bankAccountId: z.string().uuid().nullable().optional(),
   categoryId: z.string().uuid().nullable().optional(),
   attachmentUrl: z.string().nullable().optional(),
});

const installmentSchema = z.object({
   mode: z.enum(["equal", "fixed", "irregular"]),
   count: z.number().int().min(2).max(360),
   // For equal: total amount divided; for fixed: same amount per installment
   amounts: z.array(z.string()).optional(), // for irregular mode
});

const recurrenceSchema = z.object({
   frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "yearly"]),
   windowMonths: z.number().int().min(1).max(12).default(3),
   endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
});

// =============================================================================
// Procedures
// =============================================================================

export const getAll = protectedProcedure
   .input(
      z
         .object({
            type: z.enum(["payable", "receivable"]).optional(),
            status: z
               .enum(["pending", "paid", "cancelled", "overdue"])
               .optional(),
            categoryId: z.string().uuid().optional(),
            month: z.number().int().min(1).max(12).optional(),
            year: z.number().int().optional(),
            page: z.number().int().positive().default(1),
            pageSize: z.number().int().positive().max(100).default(20),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return listBills(db, { teamId, ...input });
   });

export const create = protectedProcedure
   .input(
      z.object({
         bill: billBaseSchema,
         installment: installmentSchema.optional(),
         recurrence: recurrenceSchema.optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { bill, installment, recurrence } = input;

      await verifyBillRefs(db, teamId, bill);

      // Single bill
      if (!installment && !recurrence) {
         return createBill(db, { ...bill, teamId });
      }

      // Installment group
      if (installment) {
         const groupId = crypto.randomUUID();
         const billsToCreate = Array.from(
            { length: installment.count },
            (_, i) => {
               let amount = bill.amount;
               if (installment.mode === "equal") {
                  amount = (Number(bill.amount) / installment.count).toFixed(2);
               } else if (
                  installment.mode === "irregular" &&
                  installment.amounts?.[i]
               ) {
                  amount = installment.amounts[i];
               }
               // Due date shifts by 1 month per installment
               const dueDate = computeDueDate(bill.dueDate, "monthly", i);
               return {
                  ...bill,
                  teamId,
                  amount,
                  dueDate,
                  installmentGroupId: groupId,
                  installmentIndex: i + 1,
                  installmentTotal: installment.count,
                  name: `${bill.name} (${i + 1}/${installment.count})`,
               };
            },
         );
         return createBillsBatch(db, billsToCreate);
      }

      // Recurring group
      if (recurrence) {
         const setting = await createRecurrenceSetting(db, {
            teamId,
            frequency: recurrence.frequency,
            windowMonths: recurrence.windowMonths,
            endsAt: recurrence.endsAt ?? null,
         });

         const today = new Date();
         const windowEnd = new Date(today);
         windowEnd.setMonth(windowEnd.getMonth() + recurrence.windowMonths);

         const billsToCreate = [];
         let i = 0;
         let nextDue = new Date(bill.dueDate);
         while (nextDue <= windowEnd) {
            if (recurrence.endsAt && nextDue > new Date(recurrence.endsAt))
               break;
            billsToCreate.push({
               ...bill,
               teamId,
               dueDate: nextDue.toISOString().split("T")[0],
               recurrenceGroupId: setting.id,
            });
            i++;
            nextDue = new Date(
               computeDueDate(bill.dueDate, recurrence.frequency, i),
            );
         }

         return createBillsBatch(db, billsToCreate);
      }
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(billBaseSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { id, ...data } = input;

      const existing = await getBill(db, id);
      if (!existing || existing.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
      }
      if (existing.status === "paid") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Não é possível editar uma conta já paga.",
         });
      }

      await verifyBillRefs(db, teamId, data);
      return updateBill(db, id, data);
   });

export const pay = protectedProcedure
   .input(
      z.object({
         id: z.string().uuid(),
         amount: z
            .string()
            .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0),
         date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
         bankAccountId: z.string().uuid().nullable().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const bill = await getBill(db, input.id);
      if (!bill || bill.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
      }
      if (bill.status === "paid") {
         throw new ORPCError("BAD_REQUEST", { message: "Conta já paga." });
      }

      // Create the linked transaction
      const transactionType = bill.type === "payable" ? "expense" : "income";
      const transaction = await createTransaction(
         db,
         {
            teamId,
            type: transactionType,
            amount: input.amount,
            date: input.date,
            name: bill.name,
            description: bill.description,
            bankAccountId: input.bankAccountId ?? bill.bankAccountId,
            categoryId: bill.categoryId,
         },
         [],
      );

      // Mark bill as paid
      return updateBill(db, bill.id, {
         status: "paid",
         paidAt: new Date(),
         transactionId: transaction.id,
      });
   });

export const unpay = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const bill = await getBill(db, input.id);
      if (!bill || bill.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
      }
      if (bill.status !== "paid") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Conta não está paga.",
         });
      }

      // Delete linked transaction if it exists
      if (bill.transactionId) {
         const { deleteTransaction } =
            await import("@packages/database/repositories/transactions-repository");
         await deleteTransaction(db, bill.transactionId);
      }

      return updateBill(db, bill.id, {
         status: "pending",
         paidAt: null,
         transactionId: null,
      });
   });

export const cancel = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const bill = await getBill(db, input.id);
      if (!bill || bill.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
      }

      return updateBill(db, bill.id, { status: "cancelled" });
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const bill = await getBill(db, input.id);
      if (!bill || bill.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
      }
      if (bill.status === "paid") {
         throw new ORPCError("BAD_REQUEST", {
            message:
               "Não é possível excluir uma conta já paga. Cancele primeiro.",
         });
      }

      await deleteBill(db, input.id);
      return { success: true };
   });

export const createFromTransaction = protectedProcedure
   .input(
      z.object({
         transactionId: z.string().uuid(),
         bill: billBaseSchema.omit({ amount: true }).partial({ dueDate: true }),
         amount: z
            .string()
            .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0),
         installment: installmentSchema.optional(),
         recurrence: recurrenceSchema.optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      // Re-use create handler logic by calling create directly
      return create.handler({
         context,
         input: {
            bill: {
               ...input.bill,
               amount: input.amount,
               dueDate:
                  input.bill.dueDate ?? new Date().toISOString().split("T")[0],
               type: input.bill.type ?? "payable",
               name: input.bill.name ?? "",
            },
            installment: input.installment,
            recurrence: input.recurrence,
         },
         // biome-ignore lint/suspicious/noExplicitAny: internal handler call
      } as any);
   });
```

**Step 2: Register in the router index**

In `apps/web/src/integrations/orpc/router/index.ts`, add:

```typescript
import * as billsRouter from "./bills";
```

And in the export default object:

```typescript
bills: billsRouter,
```

Add both after the `bankAccounts` entries.

**Step 3: Verify TypeScript compiles**

```bash
bun run typecheck 2>&1 | head -40
```

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/router/bills.ts apps/web/src/integrations/orpc/router/index.ts
git commit -m "feat(api): add bills oRPC router with create/pay/unpay/installments/recurrence"
```

---

## Task 4: Queue — bill recurrence

**Files:**

- Create: `packages/queue/src/bill-recurrence.ts`

**Step 1: Create the queue definition**

```typescript
// packages/queue/src/bill-recurrence.ts
import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";

export const BILL_RECURRENCE_QUEUE = "bill-recurrence";

export interface BillRecurrenceJobData {
   recurrenceGroupId: string;
   teamId: string;
}

export function createBillRecurrenceQueue(
   connection: ConnectionOptions,
): Queue<BillRecurrenceJobData> {
   return new Queue<BillRecurrenceJobData>(BILL_RECURRENCE_QUEUE, {
      connection,
      defaultJobOptions: {
         attempts: 3,
         backoff: { type: "exponential", delay: 30_000 },
         removeOnComplete: { count: 200 },
         removeOnFail: { count: 500 },
      },
   });
}
```

**Step 2: Commit**

```bash
git add packages/queue/src/bill-recurrence.ts
git commit -m "feat(queue): add bill-recurrence queue definition"
```

---

## Task 5: Worker — bill recurrence cron

**Files:**

- Create: `apps/worker/src/jobs/generate-bill-occurrences.ts`
- Create: `apps/worker/src/workers/bill-recurrence.ts`
- Modify: `apps/worker/src/scheduler.ts`
- Modify: `apps/worker/src/index.ts`

**Step 1: Create the job logic**

```typescript
// apps/worker/src/jobs/generate-bill-occurrences.ts
import type { DatabaseInstance } from "@packages/database/client";
import {
   createBillsBatch,
   getActiveRecurrenceSettings,
   getLastBillForRecurrenceGroup,
} from "@packages/database/repositories/bills-repository";

function computeNextDueDate(from: string, frequency: string): string {
   const d = new Date(from);
   switch (frequency) {
      case "weekly":
         d.setDate(d.getDate() + 7);
         break;
      case "biweekly":
         d.setDate(d.getDate() + 14);
         break;
      case "monthly":
         d.setMonth(d.getMonth() + 1);
         break;
      case "quarterly":
         d.setMonth(d.getMonth() + 3);
         break;
      case "yearly":
         d.setFullYear(d.getFullYear() + 1);
         break;
   }
   return d.toISOString().split("T")[0];
}

export async function generateBillOccurrences(
   db: DatabaseInstance,
): Promise<void> {
   const settings = await getActiveRecurrenceSettings(db);

   for (const setting of settings) {
      const lastBill = await getLastBillForRecurrenceGroup(db, setting.id);
      if (!lastBill) continue;

      const today = new Date();
      const windowEnd = new Date(today);
      windowEnd.setMonth(windowEnd.getMonth() + setting.windowMonths);

      const toCreate = [];
      let nextDue = computeNextDueDate(lastBill.dueDate, setting.frequency);

      while (new Date(nextDue) <= windowEnd) {
         if (setting.endsAt && new Date(nextDue) > new Date(setting.endsAt))
            break;

         toCreate.push({
            teamId: lastBill.teamId,
            name: lastBill.name,
            description: lastBill.description,
            type: lastBill.type,
            amount: lastBill.amount,
            dueDate: nextDue,
            bankAccountId: lastBill.bankAccountId,
            categoryId: lastBill.categoryId,
            recurrenceGroupId: setting.id,
         });

         nextDue = computeNextDueDate(nextDue, setting.frequency);
      }

      if (toCreate.length > 0) {
         await createBillsBatch(db, toCreate);
         console.log(
            `[BillRecurrence] Created ${toCreate.length} occurrences for group ${setting.id}`,
         );
      }
   }
}
```

**Step 2: Register as a scheduler job**

In `apps/worker/src/scheduler.ts`, import and add a daily cron:

```typescript
import { generateBillOccurrences } from "./jobs/generate-bill-occurrences";

// Inside startScheduler, add:
const billRecurrenceTask = cron.schedule("0 6 * * *", async () => {
   console.log("[Scheduler] Running bill recurrence generation...");
   try {
      await generateBillOccurrences(db);
      console.log("[Scheduler] Bill recurrence generation complete");
   } catch (error) {
      console.error("[Scheduler] Bill recurrence job failed:", error);
   }
});
tasks.push(billRecurrenceTask);
```

**Step 3: Verify TypeScript compiles**

```bash
bun run typecheck 2>&1 | head -40
```

**Step 4: Commit**

```bash
git add apps/worker/src/jobs/generate-bill-occurrences.ts apps/worker/src/scheduler.ts
git commit -m "feat(worker): add daily bill recurrence generation cron job"
```

---

## Task 6: Feature UI — bills columns

**Files:**

- Create: `apps/web/src/features/bills/ui/bills-columns.tsx`

**Step 1: Create the columns file**

```typescript
// apps/web/src/features/bills/ui/bills-columns.tsx
import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import {
   AlertCircle,
   Check,
   Clock,
   MoreHorizontal,
   Pencil,
   Trash2,
   XCircle,
} from "lucide-react";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";

export type BillRow = {
   id: string;
   teamId: string;
   name: string;
   type: "payable" | "receivable";
   status: "pending" | "paid" | "cancelled";
   amount: string;
   dueDate: string;
   paidAt: Date | string | null;
   installmentIndex: number | null;
   installmentTotal: number | null;
   bankAccount?: { name: string } | null;
   category?: { name: string; color: string | null } | null;
};

function computeDisplayStatus(row: BillRow): "pending" | "paid" | "overdue" | "cancelled" {
   if (row.status === "paid") return "paid";
   if (row.status === "cancelled") return "cancelled";
   const today = new Date().toISOString().split("T")[0];
   if (row.dueDate < today) return "overdue";
   return "pending";
}

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatDate(dateStr: string): string {
   const [year, month, day] = dateStr.split("-");
   return `${day}/${month}/${year}`;
}

const STATUS_CONFIG = {
   pending:   { label: "Pendente",  variant: "outline" as const,      icon: Clock },
   overdue:   { label: "Vencida",   variant: "destructive" as const,   icon: AlertCircle },
   paid:      { label: "Paga",      variant: "secondary" as const,     icon: Check },
   cancelled: { label: "Cancelada", variant: "outline" as const,       icon: XCircle },
};

export function buildBillsColumns(
   onPay: (bill: BillRow) => void,
   onEdit: (bill: BillRow) => void,
   onCancel: (bill: BillRow) => void,
   onDelete: (bill: BillRow) => void,
): ColumnDef<BillRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const { installmentIndex, installmentTotal } = row.original;
            const suffix =
               installmentIndex && installmentTotal
                  ? ` (${installmentIndex}/${installmentTotal})`
                  : "";
            return (
               <span className="font-medium">
                  {row.original.name}
                  {suffix && (
                     <span className="text-muted-foreground text-xs ml-1">{suffix}</span>
                  )}
               </span>
            );
         },
      },
      {
         accessorKey: "category",
         header: "Categoria",
         cell: ({ row }) => {
            const cat = row.original.category;
            if (!cat) return <span className="text-muted-foreground text-sm">—</span>;
            return (
               <div className="flex items-center gap-1.5">
                  {cat.color && (
                     <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                     />
                  )}
                  <span className="text-sm">{cat.name}</span>
               </div>
            );
         },
      },
      {
         accessorKey: "dueDate",
         header: "Vencimento",
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {formatDate(row.original.dueDate)}
            </span>
         ),
      },
      {
         accessorKey: "amount",
         header: "Valor",
         cell: ({ row }) => (
            <span className="font-medium tabular-nums">
               {formatBRL(row.original.amount)}
            </span>
         ),
      },
      {
         id: "status",
         header: "Status",
         cell: ({ row }) => {
            const displayStatus = computeDisplayStatus(row.original);
            const config = STATUS_CONFIG[displayStatus];
            const Icon = config.icon;
            return (
               <Badge
                  className="flex items-center gap-1 w-fit"
                  variant={config.variant}
               >
                  <Icon className="size-3" />
                  {config.label}
               </Badge>
            );
         },
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => {
            const bill = row.original;
            const displayStatus = computeDisplayStatus(bill);
            const isPaid = displayStatus === "paid";
            const isCancelled = displayStatus === "cancelled";
            const payLabel = bill.type === "payable" ? "Pagar" : "Receber";

            return (
               // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper
               <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
               >
                  {!isPaid && !isCancelled && (
                     <Button
                        className="gap-1.5"
                        onClick={() => onPay(bill)}
                        size="sm"
                        variant="default"
                     >
                        <Check className="size-3.5" />
                        {payLabel}
                     </Button>
                  )}
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                           <MoreHorizontal className="size-4" />
                           <span className="sr-only">Ações</span>
                        </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                        {!isPaid && !isCancelled && (
                           <DropdownMenuItem onClick={() => onEdit(bill)}>
                              <Pencil className="size-3.5 mr-2" />
                              Editar
                           </DropdownMenuItem>
                        )}
                        {!isPaid && !isCancelled && (
                           <DropdownMenuItem onClick={() => onCancel(bill)}>
                              <XCircle className="size-3.5 mr-2" />
                              Cancelar
                           </DropdownMenuItem>
                        )}
                        {!isPaid && (
                           <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                 className="text-destructive focus:text-destructive"
                                 onClick={() => onDelete(bill)}
                              >
                                 <Trash2 className="size-3.5 mr-2" />
                                 Excluir
                              </DropdownMenuItem>
                           </>
                        )}
                     </DropdownMenuContent>
                  </DropdownMenu>
               </div>
            );
         },
      },
   ];
}

export { formatBRL, formatDate, computeDisplayStatus, STATUS_CONFIG };
```

**Step 2: Commit**

```bash
git add apps/web/src/features/bills/ui/bills-columns.tsx
git commit -m "feat(bills): add bills table columns with status badge and pay/edit/cancel/delete actions"
```

---

## Task 7: Feature UI — installment preview

**Files:**

- Create: `apps/web/src/features/bills/ui/bill-installment-preview.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/features/bills/ui/bill-installment-preview.tsx
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { formatBRL, formatDate } from "./bills-columns";

interface InstallmentPreviewItem {
   index: number;
   dueDate: string;
   amount: string;
}

interface BillInstallmentPreviewProps {
   items: InstallmentPreviewItem[];
}

export function BillInstallmentPreview({ items }: BillInstallmentPreviewProps) {
   if (items.length === 0) return null;

   return (
      <div className="border rounded-md overflow-hidden">
         <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground flex justify-between">
            <span>Parcela</span>
            <span>Vencimento</span>
            <span>Valor</span>
         </div>
         <ScrollArea className="max-h-[200px]">
            <div className="divide-y">
               {items.map((item) => (
                  <div
                     className="px-3 py-2 flex justify-between text-sm"
                     key={`installment-${item.index}`}
                  >
                     <span className="text-muted-foreground w-12">
                        {item.index}ª
                     </span>
                     <span>{formatDate(item.dueDate)}</span>
                     <span className="font-medium tabular-nums">
                        {formatBRL(item.amount)}
                     </span>
                  </div>
               ))}
            </div>
         </ScrollArea>
      </div>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/bills/ui/bill-installment-preview.tsx
git commit -m "feat(bills): add installment preview list component"
```

---

## Task 8: Feature UI — bill pay credenza

**Files:**

- Create: `apps/web/src/features/bills/ui/bill-pay-credenza.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/features/bills/ui/bill-pay-credenza.tsx
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldError, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { MoneyInput } from "@packages/ui/components/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";
import type { BillRow } from "./bills-columns";

interface BillPayCredenzaProps {
   bill: BillRow;
   onSuccess: () => void;
}

const schema = z.object({
   amount: z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Valor deve ser maior que zero.",
   }),
   date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
   bankAccountId: z.string().uuid().nullable().optional(),
});

export function BillPayCredenza({ bill, onSuccess }: BillPayCredenzaProps) {
   const { data: accounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const payMutation = useMutation(
      orpc.bills.pay.mutationOptions({
         onSuccess: () => {
            toast.success(bill.type === "payable" ? "Conta paga com sucesso!" : "Recebimento registrado!");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao registrar pagamento.");
         },
      }),
   );

   const today = new Date().toISOString().split("T")[0];

   const form = useForm({
      defaultValues: {
         amount: bill.amount,
         date: today,
         bankAccountId: bill.bankAccount ? (bill.bankAccount as unknown as { id: string }).id ?? null : null,
      },
      validators: { onBlur: schema },
      onSubmit: async ({ value }) => {
         await payMutation.mutateAsync({
            id: bill.id,
            amount: value.amount,
            date: value.date,
            bankAccountId: value.bankAccountId,
         });
      },
   });

   const title = bill.type === "payable" ? "Registrar Pagamento" : "Registrar Recebimento";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{title}</CredenzaTitle>
            <CredenzaDescription>
               {bill.name}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <form
               id="bill-pay-form"
               onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
               }}
            >
               <FieldGroup>
                  <form.Field name="amount">
                     {(field) => (
                        <Field>
                           <FieldLabel>Valor</FieldLabel>
                           <MoneyInput
                              currency="BRL"
                              onValueChange={(v) => field.handleChange(v ?? "")}
                              value={field.state.value}
                           />
                           <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
                        </Field>
                     )}
                  </form.Field>
                  <form.Field name="date">
                     {(field) => (
                        <Field>
                           <FieldLabel>Data do Pagamento</FieldLabel>
                           <DatePicker
                              onChange={(d) =>
                                 field.handleChange(d?.toISOString().split("T")[0] ?? today)
                              }
                              value={field.state.value ? new Date(field.state.value) : undefined}
                           />
                           <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
                        </Field>
                     )}
                  </form.Field>
                  {accounts.length > 0 && (
                     <form.Field name="bankAccountId">
                        {(field) => (
                           <Field>
                              <FieldLabel>Conta Bancária</FieldLabel>
                              <Select
                                 onValueChange={field.handleChange}
                                 value={field.state.value ?? ""}
                              >
                                 <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma conta" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {accounts.map((acc) => (
                                       <SelectItem key={acc.id} value={acc.id}>
                                          {acc.name}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </form.Field>
                  )}
               </FieldGroup>
            </form>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     disabled={!state.canSubmit || payMutation.isPending}
                     form="bill-pay-form"
                     type="submit"
                  >
                     {payMutation.isPending && <Spinner className="size-4 mr-2" />}
                     Confirmar
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/bills/ui/bill-pay-credenza.tsx
git commit -m "feat(bills): add bill pay/receive confirmation credenza"
```

---

## Task 9: Feature UI — bills form (create/edit)

**Files:**

- Create: `apps/web/src/features/bills/ui/bills-form.tsx`

**Step 1: Create the form**

This is the largest component. It handles single bills, installments, and recurrence with mutually exclusive toggles.

```typescript
// apps/web/src/features/bills/ui/bills-form.tsx
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldError, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Switch } from "@packages/ui/components/switch";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { BillInstallmentPreview } from "./bill-installment-preview";
import type { BillRow } from "./bills-columns";

type BillFormMode = "create" | "edit";

interface BillFormProps {
   mode: BillFormMode;
   defaultType?: "payable" | "receivable";
   bill?: BillRow;
   onSuccess: () => void;
}

// Compute installment preview items from form state
function buildInstallmentPreview(
   baseAmount: string,
   count: number,
   startDate: string,
   splitMode: "equal" | "fixed" | "irregular",
   irregularAmounts: string[],
): { index: number; dueDate: string; amount: string }[] {
   if (!count || !startDate) return [];
   return Array.from({ length: count }, (_, i) => {
      // Shift due date by 1 month per installment
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      const dueDate = d.toISOString().split("T")[0];

      let amount = baseAmount;
      if (splitMode === "equal") {
         amount = (Number(baseAmount) / count).toFixed(2);
      } else if (splitMode === "irregular" && irregularAmounts[i]) {
         amount = irregularAmounts[i];
      }
      return { index: i + 1, dueDate, amount };
   });
}

function BillFormInner({ mode, defaultType = "payable", bill, onSuccess }: BillFormProps) {
   const { data: accounts } = useSuspenseQuery(orpc.bankAccounts.getAll.queryOptions({}));
   const { data: categories } = useSuspenseQuery(orpc.categories.getAll.queryOptions({}));

   const [isInstallment, setIsInstallment] = useState(false);
   const [isRecurring, setIsRecurring] = useState(false);
   const [splitMode, setSplitMode] = useState<"equal" | "fixed" | "irregular">("equal");

   const createMutation = useMutation(
      orpc.bills.create.mutationOptions({
         onSuccess: () => {
            toast.success("Conta criada com sucesso!");
            onSuccess();
         },
         onError: (e) => toast.error(e.message || "Erro ao criar conta."),
      }),
   );

   const updateMutation = useMutation(
      orpc.bills.update.mutationOptions({
         onSuccess: () => {
            toast.success("Conta atualizada!");
            onSuccess();
         },
         onError: (e) => toast.error(e.message || "Erro ao atualizar conta."),
      }),
   );

   const today = new Date().toISOString().split("T")[0];

   const form = useForm({
      defaultValues: {
         name: bill?.name ?? "",
         description: bill?.description ?? "",
         type: bill?.type ?? defaultType,
         amount: bill?.amount ?? "",
         dueDate: bill?.dueDate ?? today,
         bankAccountId: (bill?.bankAccount as unknown as { id: string } | null)?.id ?? "",
         categoryId: (bill?.category as unknown as { id: string } | null)?.id ?? "",
         // Installment
         installmentCount: 2,
         installmentAmounts: [] as string[],
         // Recurrence
         recurrenceFrequency: "monthly" as const,
         recurrenceWindowMonths: 3,
         recurrenceEndsAt: "",
      },
      onSubmit: async ({ value }) => {
         const billBase = {
            name: value.name,
            description: value.description || null,
            type: value.type as "payable" | "receivable",
            amount: value.amount,
            dueDate: value.dueDate,
            bankAccountId: value.bankAccountId || null,
            categoryId: value.categoryId || null,
         };

         if (mode === "edit" && bill) {
            await updateMutation.mutateAsync({ id: bill.id, ...billBase });
            return;
         }

         await createMutation.mutateAsync({
            bill: billBase,
            installment: isInstallment
               ? {
                    mode: splitMode,
                    count: value.installmentCount,
                    amounts: splitMode === "irregular" ? value.installmentAmounts : undefined,
                 }
               : undefined,
            recurrence: isRecurring
               ? {
                    frequency: value.recurrenceFrequency,
                    windowMonths: value.recurrenceWindowMonths,
                    endsAt: value.recurrenceEndsAt || null,
                 }
               : undefined,
         });
      },
   });

   const isPending = createMutation.isPending || updateMutation.isPending;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               {mode === "edit"
                  ? "Editar Conta"
                  : defaultType === "payable"
                    ? "Nova Conta a Pagar"
                    : "Nova Conta a Receber"}
            </CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody>
            <form
               id="bill-form"
               onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
               }}
            >
               <FieldGroup>
                  {/* Type selector */}
                  <form.Field name="type">
                     {(field) => (
                        <Field>
                           <FieldLabel>Tipo</FieldLabel>
                           <Select onValueChange={field.handleChange} value={field.state.value}>
                              <SelectTrigger>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="payable">A Pagar</SelectItem>
                                 <SelectItem value="receivable">A Receber</SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="name">
                     {(field) => (
                        <Field>
                           <FieldLabel>Nome</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="Ex: Aluguel, Fornecedor..."
                              value={field.state.value}
                           />
                           <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="amount">
                     {(field) => (
                        <Field>
                           <FieldLabel>Valor</FieldLabel>
                           <MoneyInput
                              currency="BRL"
                              onValueChange={(v) => field.handleChange(v ?? "")}
                              value={field.state.value}
                           />
                           <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="dueDate">
                     {(field) => (
                        <Field>
                           <FieldLabel>Vencimento</FieldLabel>
                           <DatePicker
                              onChange={(d) =>
                                 field.handleChange(d?.toISOString().split("T")[0] ?? today)
                              }
                              value={field.state.value ? new Date(field.state.value) : undefined}
                           />
                        </Field>
                     )}
                  </form.Field>

                  {accounts.length > 0 && (
                     <form.Field name="bankAccountId">
                        {(field) => (
                           <Field>
                              <FieldLabel>Conta Bancária</FieldLabel>
                              <Select onValueChange={field.handleChange} value={field.state.value}>
                                 <SelectTrigger>
                                    <SelectValue placeholder="Selecione (opcional)" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {accounts.map((acc) => (
                                       <SelectItem key={acc.id} value={acc.id}>
                                          {acc.name}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </form.Field>
                  )}

                  {categories.length > 0 && (
                     <form.Field name="categoryId">
                        {(field) => (
                           <Field>
                              <FieldLabel>Categoria</FieldLabel>
                              <Select onValueChange={field.handleChange} value={field.state.value}>
                                 <SelectTrigger>
                                    <SelectValue placeholder="Selecione (opcional)" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {categories.map((cat) => (
                                       <SelectItem key={cat.id} value={cat.id}>
                                          {cat.name}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </form.Field>
                  )}

                  <form.Field name="description">
                     {(field) => (
                        <Field>
                           <FieldLabel>Descrição (opcional)</FieldLabel>
                           <Textarea
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              rows={2}
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>

                  {/* Installment toggle — only available on create */}
                  {mode === "create" && (
                     <div className="space-y-3 border rounded-md p-3">
                        <div className="flex items-center justify-between">
                           <span className="text-sm font-medium">Parcelar</span>
                           <Switch
                              checked={isInstallment}
                              onCheckedChange={(v) => {
                                 setIsInstallment(v);
                                 if (v) setIsRecurring(false);
                              }}
                           />
                        </div>
                        {isInstallment && (
                           <div className="space-y-3 pt-2">
                              <Select
                                 onValueChange={(v) => setSplitMode(v as typeof splitMode)}
                                 value={splitMode}
                              >
                                 <SelectTrigger>
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="equal">Dividir total igualmente</SelectItem>
                                    <SelectItem value="fixed">Mesmo valor por parcela</SelectItem>
                                    <SelectItem value="irregular">Valores por parcela (irregular)</SelectItem>
                                 </SelectContent>
                              </Select>
                              <form.Field name="installmentCount">
                                 {(field) => (
                                    <Field>
                                       <FieldLabel>Número de parcelas</FieldLabel>
                                       <Input
                                          max={360}
                                          min={2}
                                          onChange={(e) =>
                                             field.handleChange(Number(e.target.value))
                                          }
                                          type="number"
                                          value={field.state.value}
                                       />
                                    </Field>
                                 )}
                              </form.Field>
                              {/* Installment preview */}
                              <form.Subscribe>
                                 {(state) => {
                                    const preview = buildInstallmentPreview(
                                       state.values.amount,
                                       state.values.installmentCount,
                                       state.values.dueDate,
                                       splitMode,
                                       state.values.installmentAmounts,
                                    );
                                    return <BillInstallmentPreview items={preview} />;
                                 }}
                              </form.Subscribe>
                           </div>
                        )}
                     </div>
                  )}

                  {/* Recurrence toggle — only available on create */}
                  {mode === "create" && (
                     <div className="space-y-3 border rounded-md p-3">
                        <div className="flex items-center justify-between">
                           <span className="text-sm font-medium">Recorrente</span>
                           <Switch
                              checked={isRecurring}
                              onCheckedChange={(v) => {
                                 setIsRecurring(v);
                                 if (v) setIsInstallment(false);
                              }}
                           />
                        </div>
                        {isRecurring && (
                           <div className="space-y-3 pt-2">
                              <form.Field name="recurrenceFrequency">
                                 {(field) => (
                                    <Field>
                                       <FieldLabel>Frequência</FieldLabel>
                                       <Select
                                          onValueChange={field.handleChange}
                                          value={field.state.value}
                                       >
                                          <SelectTrigger>
                                             <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                             <SelectItem value="weekly">Semanal</SelectItem>
                                             <SelectItem value="biweekly">Quinzenal</SelectItem>
                                             <SelectItem value="monthly">Mensal</SelectItem>
                                             <SelectItem value="quarterly">Trimestral</SelectItem>
                                             <SelectItem value="yearly">Anual</SelectItem>
                                          </SelectContent>
                                       </Select>
                                    </Field>
                                 )}
                              </form.Field>
                              <form.Field name="recurrenceWindowMonths">
                                 {(field) => (
                                    <Field>
                                       <FieldLabel>Gerar com antecedência de</FieldLabel>
                                       <div className="flex items-center gap-2">
                                          <Input
                                             className="w-20"
                                             max={12}
                                             min={1}
                                             onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                             }
                                             type="number"
                                             value={field.state.value}
                                          />
                                          <span className="text-sm text-muted-foreground">meses</span>
                                       </div>
                                    </Field>
                                 )}
                              </form.Field>
                              <form.Field name="recurrenceEndsAt">
                                 {(field) => (
                                    <Field>
                                       <FieldLabel>Terminar em (opcional)</FieldLabel>
                                       <DatePicker
                                          onChange={(d) =>
                                             field.handleChange(
                                                d?.toISOString().split("T")[0] ?? "",
                                             )
                                          }
                                          value={
                                             field.state.value
                                                ? new Date(field.state.value)
                                                : undefined
                                          }
                                       />
                                    </Field>
                                 )}
                              </form.Field>
                           </div>
                        )}
                     </div>
                  )}
               </FieldGroup>
            </form>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button disabled={!state.canSubmit || isPending} form="bill-form" type="submit">
                     {isPending && <Spinner className="size-4 mr-2" />}
                     {mode === "edit" ? "Salvar" : "Criar"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
}

export function BillForm(props: BillFormProps) {
   return (
      <Suspense fallback={null}>
         <BillFormInner {...props} />
      </Suspense>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/bills/ui/bills-form.tsx
git commit -m "feat(bills): add bill create/edit form with installment and recurrence toggles"
```

---

## Task 10: Feature UI — bill from transaction credenza

**Files:**

- Create: `apps/web/src/features/bills/ui/bill-from-transaction-credenza.tsx`

**Step 1: Create the component**

```typescript
// apps/web/src/features/bills/ui/bill-from-transaction-credenza.tsx
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldError, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Switch } from "@packages/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { BillInstallmentPreview } from "./bill-installment-preview";

type ActionMode = "installment" | "recurring";

interface BillFromTransactionCredenzaProps {
   transactionId: string;
   transactionName: string;
   transactionAmount: string;
   transactionDate: string;
   transactionType: "income" | "expense" | "transfer";
   bankAccountId?: string | null;
   categoryId?: string | null;
   mode: ActionMode;
   onSuccess: () => void;
}

function buildInstallmentPreviewLocal(
   amount: string,
   count: number,
   startDate: string,
): { index: number; dueDate: string; amount: string }[] {
   if (!count || !startDate) return [];
   return Array.from({ length: count }, (_, i) => {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      return {
         index: i + 1,
         dueDate: d.toISOString().split("T")[0],
         amount: (Number(amount) / count).toFixed(2),
      };
   });
}

export function BillFromTransactionCredenza({
   transactionId,
   transactionName,
   transactionAmount,
   transactionDate,
   transactionType,
   bankAccountId,
   categoryId,
   mode,
   onSuccess,
}: BillFromTransactionCredenzaProps) {
   const billType = transactionType === "income" ? "receivable" : "payable";

   const createMutation = useMutation(
      orpc.bills.createFromTransaction.mutationOptions({
         onSuccess: () => {
            toast.success(
               mode === "installment" ? "Parcelas criadas!" : "Recorrência criada!",
            );
            onSuccess();
         },
         onError: (e) => toast.error(e.message || "Erro ao criar conta."),
      }),
   );

   // Installment state
   const [installmentCount, setInstallmentCount] = useState(2);
   // Recurrence state
   const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly" | "quarterly" | "yearly">("monthly");
   const [windowMonths, setWindowMonths] = useState(3);

   const form = useForm({
      defaultValues: {
         name: transactionName,
         amount: transactionAmount,
         // First due date: 1 month from transaction date
         dueDate: (() => {
            const d = new Date(transactionDate);
            d.setMonth(d.getMonth() + 1);
            return d.toISOString().split("T")[0];
         })(),
      },
      onSubmit: async ({ value }) => {
         await createMutation.mutateAsync({
            transactionId,
            bill: {
               name: value.name,
               type: billType,
               dueDate: value.dueDate,
               bankAccountId: bankAccountId,
               categoryId: categoryId,
            },
            amount: value.amount,
            installment:
               mode === "installment"
                  ? { mode: "equal", count: installmentCount }
                  : undefined,
            recurrence:
               mode === "recurring"
                  ? { frequency, windowMonths }
                  : undefined,
         });
      },
   });

   const title = mode === "installment" ? "Parcelar Transação" : "Criar Transação Recorrente";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{title}</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody>
            <form
               id="bill-from-tx-form"
               onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
               }}
            >
               <FieldGroup>
                  <form.Field name="name">
                     {(field) => (
                        <Field>
                           <FieldLabel>Nome</FieldLabel>
                           <Input
                              onChange={(e) => field.handleChange(e.target.value)}
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>

                  {mode === "installment" && (
                     <>
                        <Field>
                           <FieldLabel>Número de Parcelas</FieldLabel>
                           <Input
                              max={360}
                              min={2}
                              onChange={(e) => setInstallmentCount(Number(e.target.value))}
                              type="number"
                              value={installmentCount}
                           />
                        </Field>
                        <form.Subscribe>
                           {(state) => (
                              <BillInstallmentPreview
                                 items={buildInstallmentPreviewLocal(
                                    state.values.amount,
                                    installmentCount,
                                    state.values.dueDate,
                                 )}
                              />
                           )}
                        </form.Subscribe>
                     </>
                  )}

                  {mode === "recurring" && (
                     <>
                        <Field>
                           <FieldLabel>Frequência</FieldLabel>
                           <Select
                              onValueChange={(v) => setFrequency(v as typeof frequency)}
                              value={frequency}
                           >
                              <SelectTrigger>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="weekly">Semanal</SelectItem>
                                 <SelectItem value="biweekly">Quinzenal</SelectItem>
                                 <SelectItem value="monthly">Mensal</SelectItem>
                                 <SelectItem value="quarterly">Trimestral</SelectItem>
                                 <SelectItem value="yearly">Anual</SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                        <Field>
                           <FieldLabel>Gerar com antecedência de</FieldLabel>
                           <div className="flex items-center gap-2">
                              <Input
                                 className="w-20"
                                 max={12}
                                 min={1}
                                 onChange={(e) => setWindowMonths(Number(e.target.value))}
                                 type="number"
                                 value={windowMonths}
                              />
                              <span className="text-sm text-muted-foreground">meses</span>
                           </div>
                        </Field>
                     </>
                  )}
               </FieldGroup>
            </form>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     disabled={!state.canSubmit || createMutation.isPending}
                     form="bill-from-tx-form"
                     type="submit"
                  >
                     {createMutation.isPending && <Spinner className="size-4 mr-2" />}
                     Criar
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/bills/ui/bill-from-transaction-credenza.tsx
git commit -m "feat(bills): add bill-from-transaction credenza for parcelar/recorrente actions"
```

---

## Task 11: Route — `/finance/bills`

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/bills.tsx`

**Step 1: Create the route**

```typescript
// apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/bills.tsx
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { BillForm } from "@/features/bills/ui/bills-form";
import { BillPayCredenza } from "@/features/bills/ui/bill-pay-credenza";
import {
   type BillRow,
   buildBillsColumns,
} from "@/features/bills/ui/bills-columns";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/finance/bills",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.bills.getAll.queryOptions({ input: { type: "payable" } }),
      );
      context.queryClient.prefetchQuery(
         orpc.bills.getAll.queryOptions({ input: { type: "receivable" } }),
      );
   },
   component: BillsPage,
});

// =============================================================================
// Skeleton
// =============================================================================

function BillsSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${i + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// Summary bar
// =============================================================================

function BillsSummary({ items }: { items: BillRow[] }) {
   const today = new Date().toISOString().split("T")[0];

   const pending = items
      .filter((b) => b.status === "pending" && b.dueDate >= today)
      .reduce((acc, b) => acc + Number(b.amount), 0);

   const overdue = items
      .filter((b) => b.status === "pending" && b.dueDate < today)
      .reduce((acc, b) => acc + Number(b.amount), 0);

   const paid = items
      .filter((b) => b.status === "paid")
      .reduce((acc, b) => acc + Number(b.amount), 0);

   const fmt = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

   return (
      <div className="flex gap-4 flex-wrap">
         <div className="rounded-lg border bg-background px-4 py-3 min-w-[140px]">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="font-semibold tabular-nums">{fmt(pending)}</p>
         </div>
         <div className="rounded-lg border bg-background px-4 py-3 min-w-[140px]">
            <p className="text-xs text-destructive">Vencidas</p>
            <p className="font-semibold tabular-nums text-destructive">{fmt(overdue)}</p>
         </div>
         <div className="rounded-lg border bg-background px-4 py-3 min-w-[140px]">
            <p className="text-xs text-muted-foreground">Pagas</p>
            <p className="font-semibold tabular-nums">{fmt(paid)}</p>
         </div>
      </div>
   );
}

// =============================================================================
// Bills list
// =============================================================================

function BillsList({ type }: { type: "payable" | "receivable" }) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data } = useSuspenseQuery(
      orpc.bills.getAll.queryOptions({ input: { type } }),
   );
   const items = (data?.items ?? []) as BillRow[];

   const cancelMutation = useMutation(
      orpc.bills.cancel.mutationOptions({
         onSuccess: () => toast.success("Conta cancelada."),
         onError: (e) => toast.error(e.message || "Erro ao cancelar conta."),
      }),
   );

   const deleteMutation = useMutation(
      orpc.bills.remove.mutationOptions({
         onSuccess: () => toast.success("Conta excluída."),
         onError: (e) => toast.error(e.message || "Erro ao excluir conta."),
      }),
   );

   const handlePay = useCallback(
      (bill: BillRow) => {
         openCredenza({
            children: (
               <BillPayCredenza bill={bill} onSuccess={closeCredenza} />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleEdit = useCallback(
      (bill: BillRow) => {
         openCredenza({
            children: (
               <BillForm bill={bill} mode="edit" onSuccess={closeCredenza} />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleCancel = useCallback(
      (bill: BillRow) => {
         openAlertDialog({
            title: "Cancelar conta",
            description: `Tem certeza que deseja cancelar "${bill.name}"?`,
            actionLabel: "Cancelar conta",
            cancelLabel: "Voltar",
            variant: "destructive",
            onAction: async () => {
               await cancelMutation.mutateAsync({ id: bill.id });
            },
         });
      },
      [openAlertDialog, cancelMutation],
   );

   const handleDelete = useCallback(
      (bill: BillRow) => {
         openAlertDialog({
            title: "Excluir conta",
            description: `Tem certeza que deseja excluir "${bill.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: bill.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = buildBillsColumns(handlePay, handleEdit, handleCancel, handleDelete);

   if (items.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <FileText className="size-6" />
               </EmptyMedia>
               <EmptyTitle>
                  {type === "payable" ? "Nenhuma conta a pagar" : "Nenhuma conta a receber"}
               </EmptyTitle>
               <EmptyDescription>
                  Crie uma conta para começar a controlar seus pagamentos.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <>
         <BillsSummary items={items} />
         <DataTable
            columns={columns}
            data={items}
            getRowId={(row) => row.id}
            renderMobileCard={({ row }) => (
               <div className="rounded-lg border bg-background p-4 space-y-1">
                  <p className="font-medium">{row.original.name}</p>
                  <p className="text-sm text-muted-foreground">
                     {row.original.dueDate}
                  </p>
               </div>
            )}
         />
      </>
   );
}

// =============================================================================
// Page
// =============================================================================

function BillsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const [tab, setTab] = useState<"payable" | "receivable">("payable");

   function handleCreate() {
      openCredenza({
         children: (
            <BillForm
               defaultType={tab}
               mode="create"
               onSuccess={closeCredenza}
            />
         ),
      });
   }

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate} size="sm">
                  <Plus className="size-4 mr-1" />
                  Nova Conta
               </Button>
            }
            description="Gerencie suas contas a pagar e a receber"
            title="Contas"
         />
         <Tabs onValueChange={(v) => setTab(v as typeof tab)} value={tab}>
            <TabsList>
               <TabsTrigger value="payable">A Pagar</TabsTrigger>
               <TabsTrigger value="receivable">A Receber</TabsTrigger>
            </TabsList>
            <TabsContent className="mt-4 space-y-4" value="payable">
               <Suspense fallback={<BillsSkeleton />}>
                  <BillsList type="payable" />
               </Suspense>
            </TabsContent>
            <TabsContent className="mt-4 space-y-4" value="receivable">
               <Suspense fallback={<BillsSkeleton />}>
                  <BillsList type="receivable" />
               </Suspense>
            </TabsContent>
         </Tabs>
      </main>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/bills.tsx
git commit -m "feat(bills): add /finance/bills route with payable/receivable tabs and summary bar"
```

---

## Task 12: Sidebar navigation + transaction actions

**Files:**

- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`
- Modify: `apps/web/src/features/transactions/ui/transactions-columns.tsx` (add actions to `⋯` menu)

**Step 1: Add bills to sidebar nav**

In `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`, import `Receipt` from lucide-react and add a new item inside the `finance` group items array (after `credit-cards`):

```typescript
import { ..., Receipt } from "lucide-react";

// Inside finance group items:
{
   id: "bills",
   label: "Contas",
   icon: Receipt,
   route: "/$slug/$teamSlug/finance/bills",
},
```

**Step 2: Read the transactions columns file to understand existing action structure**

Read `apps/web/src/features/transactions/ui/transactions-columns.tsx` before editing.

**Step 3: Add three new actions to the transaction row dropdown**

Find the transaction row actions menu (the `⋯` dropdown) and add three new items. Import the credenza:

```typescript
// Add to existing imports in the columns file
import { BillFromTransactionCredenza } from "@/features/bills/ui/bill-from-transaction-credenza";
```

Then in the `⋯` dropdown menu items, add after existing edit/delete actions:

```tsx
<DropdownMenuSeparator />
<DropdownMenuItem onClick={() => onInstallment(row.original)}>
   <CalendarDays className="size-3.5 mr-2" />
   Parcelar Transação
</DropdownMenuItem>
<DropdownMenuItem onClick={() => onRecurring(row.original)}>
   <Repeat className="size-3.5 mr-2" />
   Criar Transação Recorrente
</DropdownMenuItem>
{row.original.billId && (
   <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => onUnpay(row.original)}
   >
      <XCircle className="size-3.5 mr-2" />
      Marcar como Não Pago
   </DropdownMenuItem>
)}
```

The `onInstallment` and `onRecurring` callbacks open `BillFromTransactionCredenza` with `mode="installment"` or `mode="recurring"`.

**Step 4: Wire callbacks in the transactions page**

In the transactions page, pass the new callbacks to `buildTransactionColumns`:

```typescript
const handleInstallment = useCallback((tx: TransactionRow) => {
   openCredenza({
      children: (
         <BillFromTransactionCredenza
            mode="installment"
            transactionId={tx.id}
            transactionName={tx.name ?? ""}
            transactionAmount={tx.amount}
            transactionDate={tx.date}
            transactionType={tx.type}
            bankAccountId={tx.bankAccountId}
            categoryId={tx.categoryId}
            onSuccess={closeCredenza}
         />
      ),
   });
}, [openCredenza, closeCredenza]);
```

Similarly for `handleRecurring` with `mode="recurring"`.

**Step 5: Verify TypeScript compiles**

```bash
bun run typecheck 2>&1 | head -40
```

**Step 6: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts
git add apps/web/src/features/transactions/ui/transactions-columns.tsx
git add apps/web/src/features/transactions/ui/ # any other modified files
git commit -m "feat(bills): add sidebar nav item and transaction actions (parcelar, recorrente, não pago)"
```

---

## Task 13: Final verification

**Step 1: Run typecheck**

```bash
bun run typecheck 2>&1 | head -60
```

Expected: no errors in new files.

**Step 2: Run lint**

```bash
bun run check 2>&1 | head -60
```

Fix any Biome errors reported.

**Step 3: Run tests**

```bash
bun run test 2>&1 | tail -20
```

Expected: existing tests still pass.

**Step 4: Final commit**

```bash
git add -p  # review and stage any remaining changes
git commit -m "chore: finalize bills module implementation"
```

---

## Summary

| Task | What it does                                                                    |
| ---- | ------------------------------------------------------------------------------- |
| 1    | Schema: `bills` + `recurrence_settings` tables                                  |
| 2    | Repository: CRUD + batch create + recurrence queries                            |
| 3    | oRPC router: getAll/create/update/pay/unpay/cancel/remove/createFromTransaction |
| 4    | BullMQ queue definition for bill recurrence                                     |
| 5    | Daily cron job to fill rolling window for recurring bills                       |
| 6    | Table columns with status badge + pay/edit/cancel/delete actions                |
| 7    | Installment preview list component                                              |
| 8    | Pay/receive confirmation credenza                                               |
| 9    | Full create/edit form with installment + recurrence toggles                     |
| 10   | "From transaction" credenza (parcelar / criar recorrente)                       |
| 11   | `/finance/bills` route with tabs + summary bar                                  |
| 12   | Sidebar nav item + transaction row actions (parcelar, recorrente, não pago)     |
| 13   | Final typecheck + lint + test verification                                      |
