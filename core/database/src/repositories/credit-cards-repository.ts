import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
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

export type BulkCreateCreditCardInput = {
   name: string;
   creditLimit: string;
   closingDay: number;
   dueDay: number;
   color?: string;
   status?: "active" | "blocked" | "cancelled";
   brand?: "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other";
   bankAccountId: string;
};

export async function bulkCreateCreditCards(
   db: DatabaseInstance,
   teamId: string,
   cards: BulkCreateCreditCardInput[],
) {
   try {
      const rows = cards.map((c) => ({
         teamId,
         name: c.name,
         creditLimit: c.creditLimit,
         closingDay: c.closingDay,
         dueDay: c.dueDay,
         color: c.color ?? "#6366f1",
         status: c.status ?? ("active" as const),
         brand: c.brand,
         bankAccountId: c.bankAccountId,
      }));

      const created = await db
         .insert(creditCards)
         .values(rows)
         .returning({ id: creditCards.id });

      return { created: created.length };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Falha ao importar cartões");
   }
}

export type ListCreditCardsFilter = {
   page?: number;
   pageSize?: number;
   search?: string;
   status?: "active" | "blocked" | "cancelled";
};

export async function listCreditCards(
   db: DatabaseInstance,
   teamId: string,
   filter: ListCreditCardsFilter = {},
) {
   const { page = 1, pageSize = 20, search, status } = filter;
   const offset = (page - 1) * pageSize;

   try {
      const where = and(
         eq(creditCards.teamId, teamId),
         status ? eq(creditCards.status, status) : undefined,
         search ? ilike(creditCards.name, `%${search}%`) : undefined,
      );

      const [data, countResult] = await Promise.all([
         db
            .select()
            .from(creditCards)
            .where(where)
            .orderBy(asc(creditCards.name))
            .limit(pageSize)
            .offset(offset),
         db
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(creditCards)
            .where(where),
      ]);

      const totalCount = countResult[0]?.count ?? 0;

      return {
         data,
         totalCount,
         page,
         pageSize,
         totalPages: Math.ceil(totalCount / pageSize),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Falha ao listar cartões de crédito");
   }
}

export async function getCreditCardsSummary(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      const [row] = await db
         .select({
            totalCards: sql<number>`cast(count(*) as int)`,
            totalLimit: sql<string>`coalesce(cast(sum(credit_limit) as text), '0')`,
            activeCards: sql<number>`cast(count(*) filter (where status = 'active') as int)`,
         })
         .from(creditCards)
         .where(eq(creditCards.teamId, teamId));

      return {
         totalCards: row?.totalCards ?? 0,
         totalLimit: row?.totalLimit ?? "0",
         activeCards: row?.activeCards ?? 0,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Falha ao carregar resumo de cartões");
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
      for (const card of cards) {
         const hasOpen = await creditCardHasOpenStatements(db, card.id);
         if (hasOpen) {
            throw AppError.conflict(
               `Cartão "${card.name}" possui faturas abertas e não pode ser excluído.`,
            );
         }
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
