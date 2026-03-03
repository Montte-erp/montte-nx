import { AppError, propagateError } from "@packages/utils/errors";
import type { SQL } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   categories,
   type NewCategory,
   subcategories,
   transactions,
} from "../schema";

export const DEFAULT_CATEGORIES = [
   "Alimentação",
   "Casa",
   "Educação",
   "Lazer",
   "Saúde",
   "Transporte",
   "Viagem",
   "Salário",
   "Investimento",
];

export async function createCategory(db: DatabaseInstance, data: NewCategory) {
   try {
      const [category] = await db.insert(categories).values(data).returning();
      return category;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create category");
   }
}

export async function seedDefaultCategories(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      const values = DEFAULT_CATEGORIES.map((name) => ({
         teamId,
         name,
         isDefault: true,
      }));
      await db.insert(categories).values(values).onConflictDoNothing();
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to seed default categories");
   }
}

export async function listCategories(
   db: DatabaseInstance,
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   try {
      const catConditions: SQL[] = [eq(categories.teamId, teamId)];
      if (!opts?.includeArchived) {
         catConditions.push(eq(categories.isArchived, false));
      }

      const cats = await db
         .select()
         .from(categories)
         .where(and(...catConditions))
         .orderBy(categories.name);

      const subs = await db
         .select()
         .from(subcategories)
         .where(eq(subcategories.teamId, teamId))
         .orderBy(subcategories.name);

      return cats.map((cat) => ({
         ...cat,
         subcategories: subs.filter((s) => s.categoryId === cat.id),
      }));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list categories");
   }
}

export async function getCategory(db: DatabaseInstance, id: string) {
   try {
      const [category] = await db
         .select()
         .from(categories)
         .where(eq(categories.id, id));
      return category ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get category");
   }
}

export async function updateCategory(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewCategory>,
) {
   try {
      const [updated] = await db
         .update(categories)
         .set(data)
         .where(eq(categories.id, id))
         .returning();
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update category");
   }
}

export async function deleteCategory(db: DatabaseInstance, id: string) {
   try {
      await db.delete(categories).where(eq(categories.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete category");
   }
}

export async function categoryHasTransactions(
   db: DatabaseInstance,
   categoryId: string,
): Promise<boolean> {
   try {
      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactions)
         .where(eq(transactions.categoryId, categoryId));
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check category transactions");
   }
}
