import { os } from "@orpc/server";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { asc, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
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

export type CreditCardSortingRule = {
   id:
      | "bankAccountId"
      | "brand"
      | "closingDay"
      | "creditLimit"
      | "dueDay"
      | "name"
      | "status";
   desc: boolean;
};

export function buildCreditCardOrderBy(
   sorting: CreditCardSortingRule[] | undefined,
) {
   if (!sorting?.length)
      return [asc(creditCards.name), desc(creditCards.createdAt)];
   const orderBy: SQL[] = [];

   for (const sort of sorting) {
      const direction = sort.desc ? desc : asc;
      switch (sort.id) {
         case "bankAccountId":
            orderBy.push(direction(creditCards.bankAccountId));
            break;
         case "brand":
            orderBy.push(direction(creditCards.brand));
            break;
         case "closingDay":
            orderBy.push(direction(creditCards.closingDay));
            break;
         case "creditLimit":
            orderBy.push(direction(creditCards.creditLimit));
            break;
         case "dueDay":
            orderBy.push(direction(creditCards.dueDay));
            break;
         case "name":
            orderBy.push(direction(creditCards.name));
            break;
         case "status":
            orderBy.push(direction(creditCards.status));
            break;
      }
   }

   return [...orderBy, desc(creditCards.createdAt)];
}

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
