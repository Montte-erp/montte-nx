import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";
import { defineErrorCatalog } from "evlog";
import { Result, TaggedError } from "better-result";
import {
   computeClosingDate,
   computeDueDate,
} from "@core/database/helpers/credit-card-dates";
import {
   creditCardStatements,
   type CreditCardStatement,
} from "@core/database/schemas/credit-card-statements";
import type { DatabaseInstance } from "@core/database/client";

const cardsCloseStatementErrors = defineErrorCatalog("cards.statements.close", {
   CARD_NOT_FOUND: {
      status: 404,
      message: "Cartão não encontrado.",
      tags: ["cards", "statement", "close"],
   },
   DB_QUERY_FAILED: {
      status: 500,
      message: "Falha ao consultar dados para fechamento da fatura.",
      tags: ["cards", "statement", "close", "query"],
   },
   CLOSE_STATEMENT_FAILED: {
      status: 500,
      message: "Falha ao fechar fatura.",
      tags: ["cards", "statement", "close"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cards.statements.close": typeof cardsCloseStatementErrors;
   }
}

type CardsCloseStatementCatalogError =
   | ReturnType<typeof cardsCloseStatementErrors.CARD_NOT_FOUND>
   | ReturnType<typeof cardsCloseStatementErrors.DB_QUERY_FAILED>
   | ReturnType<typeof cardsCloseStatementErrors.CLOSE_STATEMENT_FAILED>;

export class CloseStatementError extends TaggedError("CloseStatementError")<{
   error: CardsCloseStatementCatalogError;
   message: string;
   creditCardId: string;
   statementPeriod: string;
   teamId: string;
}>() {}

export type CloseStatementInput = {
   db: DatabaseInstance;
   creditCardId: string;
   statementPeriod: string;
   teamId: string;
   status?: "closed" | "paid";
};

export async function closeStatement(input: CloseStatementInput) {
   const cardResult = await Result.tryPromise({
      try: () =>
         input.db.query.creditCards.findFirst({
            where: (fields, { and, eq }) =>
               and(
                  eq(fields.id, input.creditCardId),
                  eq(fields.teamId, input.teamId),
               ),
         }),
      catch: () =>
         new CloseStatementError({
            error: cardsCloseStatementErrors.DB_QUERY_FAILED(),
            message: "Falha ao localizar cartão para fechamento.",
            creditCardId: input.creditCardId,
            statementPeriod: input.statementPeriod,
            teamId: input.teamId,
         }),
   });
   if (Result.isError(cardResult)) return Result.err(cardResult.error);
   const card = cardResult.value;
   if (!card) {
      return Result.err(
         new CloseStatementError({
            error: cardsCloseStatementErrors.CARD_NOT_FOUND(),
            message: "Cartão não encontrado.",
            creditCardId: input.creditCardId,
            statementPeriod: input.statementPeriod,
            teamId: input.teamId,
         }),
      );
   }

   const closingDate = computeClosingDate(
      input.statementPeriod,
      card.closingDay,
   );
   const dueDate = computeDueDate(
      input.statementPeriod,
      card.closingDay,
      card.dueDay,
   );

   const closedStatement = await Result.tryPromise({
      try: () =>
         input.db.transaction(async (tx): Promise<CreditCardStatement> => {
            const [created] = await tx
               .insert(creditCardStatements)
               .values({
                  creditCardId: input.creditCardId,
                  statementPeriod: input.statementPeriod,
                  closingDate,
                  dueDate,
               })
               .onConflictDoNothing()
               .returning();

            const current =
               created ??
               (await tx.query.creditCardStatements.findFirst({
                  where: (fields, { and, eq }) =>
                     and(
                        eq(fields.creditCardId, input.creditCardId),
                        eq(fields.statementPeriod, input.statementPeriod),
                     ),
               }));

            if (!current) {
               throw new Error(
                  "Falha ao localizar fatura após tentativa de fechamento.",
               );
            }

            if (current.status === "paid") {
               return current;
            }

            const targetStatus = input.status ?? "closed";

            if (current.status === targetStatus) {
               const [updated] = await tx
                  .update(creditCardStatements)
                  .set({
                     closingDate,
                     dueDate,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(
                     and(
                        eq(creditCardStatements.id, current.id),
                        eq(creditCardStatements.status, current.status),
                     ),
                  )
                  .returning();

               if (!updated) {
                  return current;
               }

               return updated;
            }

            const [updated] = await tx
               .update(creditCardStatements)
               .set({
                  status: targetStatus,
                  closingDate,
                  dueDate,
                  updatedAt: dayjs().toDate(),
               })
               .where(
                  and(
                     eq(creditCardStatements.id, current.id),
                     eq(creditCardStatements.status, current.status),
                  ),
               )
               .returning();

            if (!updated) {
               return current;
            }

            return updated;
         }),
      catch: () =>
         new CloseStatementError({
            error: cardsCloseStatementErrors.CLOSE_STATEMENT_FAILED(),
            message: "Falha ao fechar fatura.",
            creditCardId: input.creditCardId,
            statementPeriod: input.statementPeriod,
            teamId: input.teamId,
         }),
   });
   if (Result.isError(closedStatement))
      return Result.err(closedStatement.error);

   return Result.ok(closedStatement.value);
}
