import { os } from "@orpc/server";
import { Result, TaggedError } from "better-result";
import { and, eq } from "drizzle-orm";
import { defineErrorCatalog } from "evlog";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { creditCards } from "@core/database/schemas/credit-cards";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

export const cardsRouterErrors = defineErrorCatalog("cards.router", {
   BAD_REQUEST: {
      status: 400,
      message: "Requisição inválida em cartões.",
      tags: ["cards", "router"],
   },
   CONFLICT: {
      status: 409,
      message: "Conflito em cartões.",
      tags: ["cards", "router"],
   },
   INTERNAL: {
      status: 500,
      message: "Falha interna em cartões.",
      tags: ["cards", "router"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Cartão não encontrado.",
      tags: ["cards", "router"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cards.router": typeof cardsRouterErrors;
   }
}

type CardsRouterCatalogError =
   | ReturnType<typeof cardsRouterErrors.BAD_REQUEST>
   | ReturnType<typeof cardsRouterErrors.CONFLICT>
   | ReturnType<typeof cardsRouterErrors.INTERNAL>
   | ReturnType<typeof cardsRouterErrors.NOT_FOUND>;

export class CardsRouterError extends TaggedError("CardsRouterError")<{
   error: CardsRouterCatalogError;
   message: string;
}>() {}

export const requireCreditCard = base.middleware(
   async ({ context, next }, id: string) => {
      const card = await Result.tryPromise({
         try: () =>
            context.db.query.creditCards.findFirst({
               where: (f, { eq }) => eq(f.id, id),
            }),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao verificar permissão.",
            }),
      });
      if (Result.isError(card)) throw card.error;
      if (!card.value || card.value.teamId !== context.teamId) {
         throw new CardsRouterError({
            error: cardsRouterErrors.NOT_FOUND(),
            message: "Cartão de crédito não encontrado.",
         });
      }
      return next({ context: { creditCard: card.value } });
   },
);

export const requireStatement = base.middleware(
   async ({ context, next }, id: string) => {
      const statement = await Result.tryPromise({
         try: () =>
            context.db
               .select({ statement: creditCardStatements })
               .from(creditCardStatements)
               .innerJoin(
                  creditCards,
                  eq(creditCardStatements.creditCardId, creditCards.id),
               )
               .where(
                  and(
                     eq(creditCardStatements.id, id),
                     eq(creditCards.teamId, context.teamId),
                  ),
               )
               .limit(1),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao verificar fatura.",
            }),
      });
      if (Result.isError(statement)) throw statement.error;

      const row = statement.value[0]?.statement;
      if (!row) {
         throw new CardsRouterError({
            error: cardsRouterErrors.NOT_FOUND(),
            message: "Fatura não encontrada.",
         });
      }

      return next({ context: { statement: row } });
   },
);
