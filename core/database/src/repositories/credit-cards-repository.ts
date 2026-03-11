import { AppError, propagateError, validateInput } from "@core/logging/errors";
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
