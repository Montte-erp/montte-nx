import { AppError, propagateError } from "@core/utils/errors";
import { desc, eq } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { creditCards, type NewCreditCard } from "../schema";

export async function createCreditCard(
   db: DatabaseInstance,
   data: NewCreditCard,
) {
   try {
      const [card] = await db.insert(creditCards).values(data).returning();
      return card;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create credit card");
   }
}

export async function listCreditCards(db: DatabaseInstance, teamId: string) {
   try {
      return await db
         .select()
         .from(creditCards)
         .where(eq(creditCards.teamId, teamId))
         .orderBy(desc(creditCards.createdAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list credit cards");
   }
}

export async function getCreditCard(db: DatabaseInstance, id: string) {
   try {
      const [card] = await db
         .select()
         .from(creditCards)
         .where(eq(creditCards.id, id));
      return card ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get credit card");
   }
}

export async function updateCreditCard(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewCreditCard>,
) {
   try {
      const [updated] = await db
         .update(creditCards)
         .set(data)
         .where(eq(creditCards.id, id))
         .returning();
      if (!updated) {
         throw AppError.database("Credit card not found");
      }
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update credit card");
   }
}

export async function deleteCreditCard(db: DatabaseInstance, id: string) {
   try {
      await db.delete(creditCards).where(eq(creditCards.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete credit card");
   }
}
