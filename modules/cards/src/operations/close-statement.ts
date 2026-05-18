import dayjs from "dayjs";
import { defineErrorCatalog } from "evlog";
import { and, eq } from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { creditCards } from "@core/database/schemas/credit-cards";
import type { DatabaseInstance } from "@core/database/client";

const cardsCloseStatementErrors = defineErrorCatalog("cards.close-statement", {
   QUERY_FAILED: {
      status: 500,
      message: "Falha ao localizar fatura para fechamento.",
      tags: ["cards", "statement", "close"],
   },
   UPDATE_FAILED: {
      status: 500,
      message: "Falha ao fechar fatura.",
      tags: ["cards", "statement", "close"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cards.close-statement": typeof cardsCloseStatementErrors;
   }
}

type CardsCloseStatementCatalogError =
   | ReturnType<typeof cardsCloseStatementErrors.QUERY_FAILED>
   | ReturnType<typeof cardsCloseStatementErrors.UPDATE_FAILED>;

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
};

export async function closeStatement(input: CloseStatementInput) {
   const statement = await Result.tryPromise({
      try: () =>
         input.db
            .select({
               statementId: creditCardStatements.id,
            })
            .from(creditCardStatements)
            .innerJoin(
               creditCards,
               eq(creditCardStatements.creditCardId, creditCards.id),
            )
            .where(
               and(
                  eq(creditCardStatements.creditCardId, input.creditCardId),
                  eq(
                     creditCardStatements.statementPeriod,
                     input.statementPeriod,
                  ),
                  eq(creditCards.teamId, input.teamId),
                  eq(creditCardStatements.status, "open"),
               ),
            )
            .limit(1),
      catch: () =>
         new CloseStatementError({
            error: cardsCloseStatementErrors.QUERY_FAILED(),
            message: "Falha ao localizar fatura para fechamento.",
            creditCardId: input.creditCardId,
            statementPeriod: input.statementPeriod,
            teamId: input.teamId,
         }),
   });

   if (Result.isError(statement)) return Result.err(statement.error);
   const row = statement.value[0];
   if (!row) {
      return Result.ok();
   }

   const updated = await Result.tryPromise({
      try: () =>
         input.db.transaction(async (tx) =>
            tx
               .update(creditCardStatements)
               .set({
                  status: "paid",
                  paymentTransactionId: null,
                  updatedAt: dayjs().toDate(),
               })
               .where(eq(creditCardStatements.id, row.statementId))
               .returning({ id: creditCardStatements.id }),
         ),
      catch: () =>
         new CloseStatementError({
            error: cardsCloseStatementErrors.UPDATE_FAILED(),
            message: "Falha ao fechar fatura.",
            creditCardId: input.creditCardId,
            statementPeriod: input.statementPeriod,
            teamId: input.teamId,
         }),
   });
   if (Result.isError(updated)) return Result.err(updated.error);
   if (!updated.value[0]) {
      return Result.ok();
   }

   return Result.ok();
}
