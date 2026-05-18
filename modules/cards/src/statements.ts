import { Result } from "better-result";
import { and, eq, inArray } from "drizzle-orm";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { creditCards } from "@core/database/schemas/credit-cards";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import {
   CardsRouterError,
   cardsRouterErrors,
} from "@modules/cards/credit-cards";

export async function findCreditCardStatement(
   db: ORPCContextWithOrganization["db"],
   id: string,
   teamId: string,
) {
   const statement = await Result.tryPromise({
      try: () =>
         db
            .select({ statement: creditCardStatements })
            .from(creditCardStatements)
            .innerJoin(
               creditCards,
               eq(creditCardStatements.creditCardId, creditCards.id),
            )
            .where(
               and(
                  eq(creditCardStatements.id, id),
                  eq(creditCards.teamId, teamId),
               ),
            )
            .limit(1),
      catch: () =>
         new CardsRouterError({
            error: cardsRouterErrors.INTERNAL(),
            message: "Falha ao verificar fatura.",
         }),
   });

   if (Result.isError(statement)) return Result.err(statement.error);
   return Result.ok(statement.value[0]?.statement);
}

export async function findBlockingOpenStatement(
   db: ORPCContextWithOrganization["db"],
   creditCardIds: string[],
) {
   if (!creditCardIds.length) return Result.ok(undefined);

   const open = await Result.tryPromise({
      try: () =>
         db
            .select({
               creditCardId: creditCardStatements.creditCardId,
               name: creditCards.name,
            })
            .from(creditCardStatements)
            .innerJoin(
               creditCards,
               eq(creditCardStatements.creditCardId, creditCards.id),
            )
            .where(
               and(
                  inArray(creditCardStatements.creditCardId, creditCardIds),
                  eq(creditCardStatements.status, "open"),
               ),
            )
            .limit(1),
      catch: () =>
         new CardsRouterError({
            error: cardsRouterErrors.INTERNAL(),
            message: "Falha ao verificar faturas.",
         }),
   });

   if (Result.isError(open)) return Result.err(open.error);
   return Result.ok(open.value[0]);
}
