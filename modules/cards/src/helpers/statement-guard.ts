import { or } from "drizzle-orm";
import { defineErrorCatalog } from "evlog";
import { Result, TaggedError } from "better-result";
import type { DatabaseInstance } from "@core/database/client";

const cardsStatementGuardErrors = defineErrorCatalog("cards.statement-guard", {
   CLOSED_STATEMENT: {
      status: 409,
      message: "Não é possível editar lançamento de fatura fechada.",
      tags: ["cards", "statement", "guard"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cards.statement-guard": typeof cardsStatementGuardErrors;
   }
}

type StatementGuardCatalogError = ReturnType<
   typeof cardsStatementGuardErrors.CLOSED_STATEMENT
>;

export class StatementGuardError extends TaggedError("StatementGuardError")<{
   error: StatementGuardCatalogError;
   creditCardId: string;
   statementPeriod: string;
   message: string;
}>() {}

export async function assertTransactionEditable(
   db: DatabaseInstance,
   creditCardId: string,
   statementPeriod: string,
): Promise<Result<void, StatementGuardError>> {
   const statement = await db.query.creditCardStatements.findFirst({
      where: (fields, { and, eq }) =>
         and(
            eq(fields.creditCardId, creditCardId),
            eq(fields.statementPeriod, statementPeriod),
            or(eq(fields.status, "paid"), eq(fields.status, "closed")),
         ),
   });

   if (statement) {
      return Result.err(
         new StatementGuardError({
            error: cardsStatementGuardErrors.CLOSED_STATEMENT(),
            message: "Não é possível editar lançamento de fatura fechada.",
            creditCardId,
            statementPeriod,
         }),
      );
   }

   return Result.ok();
}
