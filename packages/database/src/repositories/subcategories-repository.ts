import { AppError, propagateError } from "@packages/utils/errors";
import { and, eq, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { type NewSubcategory, subcategories, transactions } from "../schema";

export async function getSubcategory(db: DatabaseInstance, id: string) {
   try {
      const [sub] = await db
         .select()
         .from(subcategories)
         .where(eq(subcategories.id, id));
      return sub ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get subcategory");
   }
}

export async function listSubcategoriesByCategoryId(
   db: DatabaseInstance,
   categoryId: string,
   teamId: string,
) {
   try {
      return await db
         .select()
         .from(subcategories)
         .where(
            and(
               eq(subcategories.categoryId, categoryId),
               eq(subcategories.teamId, teamId),
            ),
         )
         .orderBy(subcategories.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list subcategories");
   }
}

export async function createSubcategory(
   db: DatabaseInstance,
   data: NewSubcategory,
) {
   try {
      const [sub] = await db.insert(subcategories).values(data).returning();
      return sub;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create subcategory");
   }
}

export async function updateSubcategory(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewSubcategory>,
) {
   try {
      const [updated] = await db
         .update(subcategories)
         .set(data)
         .where(eq(subcategories.id, id))
         .returning();
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update subcategory");
   }
}

export async function deleteSubcategory(db: DatabaseInstance, id: string) {
   try {
      await db.delete(subcategories).where(eq(subcategories.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete subcategory");
   }
}

export async function subcategoryHasTransactions(
   db: DatabaseInstance,
   subcategoryId: string,
): Promise<boolean> {
   try {
      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactions)
         .where(eq(transactions.subcategoryId, subcategoryId));
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check subcategory transactions");
   }
}
