import dayjs from "dayjs";
import type { DatabaseInstance } from "@core/database/client";
import {
   categories,
   type NewCategory,
} from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";

export async function makeCategory(
   db: DatabaseInstance,
   teamId: string,
   overrides: Partial<NewCategory> = {},
) {
   const [row] = await db
      .insert(categories)
      .values({
         teamId,
         name: overrides.name ?? `Categoria ${crypto.randomUUID().slice(0, 6)}`,
         type: overrides.type ?? "expense",
         level: overrides.level ?? 1,
         ...overrides,
      })
      .returning();
   if (!row) throw new Error("makeCategory: insert returned no row");
   return row;
}

export async function makeTag(
   db: DatabaseInstance,
   teamId: string,
   overrides: Partial<typeof tags.$inferInsert> = {},
) {
   const [row] = await db
      .insert(tags)
      .values({
         teamId,
         name: overrides.name ?? `Tag ${crypto.randomUUID().slice(0, 6)}`,
         ...overrides,
      })
      .returning();
   if (!row) throw new Error("makeTag: insert returned no row");
   return row;
}

export async function makeTransaction(
   db: DatabaseInstance,
   teamId: string,
   overrides: Partial<typeof transactions.$inferInsert> = {},
) {
   const [row] = await db
      .insert(transactions)
      .values({
         teamId,
         name: overrides.name ?? "Transação teste",
         type: overrides.type ?? "expense",
         amount: overrides.amount ?? "100.00",
         date: overrides.date ?? dayjs().format("YYYY-MM-DD"),
         status: overrides.status ?? "paid",
         ...overrides,
      })
      .returning();
   if (!row) throw new Error("makeTransaction: insert returned no row");
   return row;
}
