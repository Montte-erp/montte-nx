import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { eq, inArray } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateCreditCardInput,
   type UpdateCreditCardInput,
   creditCards,
   createCreditCardSchema,
   updateCreditCardSchema,
} from "@core/database/schemas/credit-cards";

export async function createCreditCard(
   db: DatabaseInstance,
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

export async function listCreditCards(db: DatabaseInstance, teamId: string) {
   try {
      return await db.query.creditCards.findMany({
         where: (fields, { eq }) => eq(fields.teamId, teamId),
         orderBy: (fields, { desc }) => [desc(fields.createdAt)],
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list credit cards");
   }
}

export async function getCreditCard(db: DatabaseInstance, id: string) {
   try {
      const card = await db.query.creditCards.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      return card ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get credit card");
   }
}

export async function updateCreditCard(
   db: DatabaseInstance,
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

export async function deleteCreditCard(db: DatabaseInstance, id: string) {
   try {
      const hasOpenStatements = await creditCardHasOpenStatements(db, id);
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

export async function bulkDeleteCreditCards(
   db: DatabaseInstance,
   ids: string[],
   teamId: string,
) {
   try {
      const cards = await db.query.creditCards.findMany({
         where: (fields, { and, inArray }) =>
            and(inArray(fields.id, ids), eq(fields.teamId, teamId)),
      });
      if (cards.length !== ids.length) {
         throw AppError.notFound("Um ou mais cartões não encontrados.");
      }
      await db.delete(creditCards).where(inArray(creditCards.id, ids));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to bulk delete credit cards");
   }
}

export async function ensureCreditCardOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const card = await getCreditCard(db, id);
   if (!card || card.teamId !== teamId) {
      throw AppError.notFound("Cartão de crédito não encontrado.");
   }
   return card;
}

export async function creditCardHasOpenStatements(
   db: DatabaseInstance,
   creditCardId: string,
) {
   try {
      const statement = await db.query.creditCardStatements.findFirst({
         where: (fields, { and, eq }) =>
            and(
               eq(fields.creditCardId, creditCardId),
               eq(fields.status, "open"),
            ),
      });
      return !!statement;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check credit card statements");
   }
}
