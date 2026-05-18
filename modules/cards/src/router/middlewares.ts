import { os } from "@orpc/server";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
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
