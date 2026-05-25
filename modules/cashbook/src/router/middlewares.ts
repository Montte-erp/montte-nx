import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { os } from "@orpc/server";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { transactions } from "@core/database/schemas/transactions";

const cashbookMiddlewareErrors = defineErrorCatalog(
   "cashbook.router.middleware",
   {
      BAD_REQUEST: {
         status: 400,
         message: "Referência de caixa inválida.",
         tags: ["cashbook"],
      },
      FORBIDDEN: {
         status: 403,
         message: "Ação não permitida em caixa.",
         tags: ["cashbook"],
      },
      INTERNAL: {
         status: 500,
         message: "Falha interna no router de caixa.",
         tags: ["cashbook"],
      },
      NOT_FOUND: {
         status: 404,
         message: "Registro de caixa não encontrado.",
         tags: ["cashbook"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cashbook.router.middleware": typeof cashbookMiddlewareErrors;
   }
}

type CashbookMiddlewareCatalogError =
   | ReturnType<typeof cashbookMiddlewareErrors.BAD_REQUEST>
   | ReturnType<typeof cashbookMiddlewareErrors.FORBIDDEN>
   | ReturnType<typeof cashbookMiddlewareErrors.INTERNAL>
   | ReturnType<typeof cashbookMiddlewareErrors.NOT_FOUND>;

class CashbookMiddlewareError extends TaggedError("CashbookMiddlewareError")<{
   error: CashbookMiddlewareCatalogError;
   message: string;
}>() {}

const base = os.$context<ORPCContextWithOrganization>();

export const requireBankAccount = base.middleware(
   async ({ context, next }, id: string) => {
      const account = await Result.tryPromise({
         try: () =>
            context.db.query.bankAccounts.findFirst({
               where: (f, { eq }) => eq(f.id, id),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar permissão.",
            }),
      });
      if (Result.isError(account)) throw account.error;
      if (!account.value || account.value.teamId !== context.teamId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.NOT_FOUND(),
            message: "Conta bancária não encontrada.",
         });
      }
      return next({ context: { bankAccount: account.value } });
   },
);

export const requireTransaction = base.middleware(
   async ({ context, next }, id: string) => {
      const transaction = await Result.tryPromise({
         try: () =>
            context.db.query.transactions.findFirst({
               where: (f, { eq }) => eq(f.id, id),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar permissão.",
            }),
      });
      if (Result.isError(transaction)) throw transaction.error;
      if (!transaction.value || transaction.value.teamId !== context.teamId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.NOT_FOUND(),
            message: "Lançamento não encontrado.",
         });
      }
      return next({ context: { transaction: transaction.value } });
   },
);

export const requireTransactionRecurrence = base.middleware(
   async ({ context, next }, id: string) => {
      const recurrence = await Result.tryPromise({
         try: () =>
            context.db.query.transactionRecurrences.findFirst({
               where: (f, { eq }) => eq(f.id, id),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar recorrência.",
            }),
      });
      if (Result.isError(recurrence)) throw recurrence.error;
      if (!recurrence.value || recurrence.value.teamId !== context.teamId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.NOT_FOUND(),
            message: "Recorrência não encontrada.",
         });
      }
      return next({ context: { recurrence: recurrence.value } });
   },
);

export const requireOwnedTransactionIds = base.middleware(
   async ({ context, next }, ids: string[]) => {
      if (ids.length === 0) return next();

      const result = await Result.tryPromise({
         try: () =>
            context.db
               .select({ id: transactions.id })
               .from(transactions)
               .where(
                  and(
                     inArray(transactions.id, ids),
                     eq(transactions.teamId, context.teamId),
                  ),
               ),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar permissão.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (result.value.length !== ids.length) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.NOT_FOUND(),
            message: "Um ou mais lançamentos não encontrados.",
         });
      }
      return next();
   },
);

export const enforceCostCenterPolicy = base.middleware(
   async ({ context, next }, tagId: string | null | undefined) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.query.financialConfig.findFirst({
               where: (f, { eq }) => eq(f.teamId, context.teamId),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar configurações.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (result.value?.costCenterRequired && !tagId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.FORBIDDEN(),
            message: "Centro de Custo é obrigatório para este espaço.",
         });
      }
      return next();
   },
);

export type FinancialReferences = {
   bankAccountId?: string | null;
   destinationBankAccountId?: string | null;
   categoryId?: string | null;
   tagId?: string | null;
   relationshipId?: string | null;
   date?: Date | string | null;
};

export async function requireValidFinancialReferences(
   db: ORPCContextWithOrganization["db"],
   teamId: string,
   refs: FinancialReferences,
) {
   if (refs.bankAccountId) {
      const account = await Result.tryPromise({
         try: () =>
            db.query.bankAccounts.findFirst({
               where: (f, { eq }) => eq(f.id, refs.bankAccountId ?? ""),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar conta bancária.",
            }),
      });
      if (Result.isError(account)) throw account.error;
      if (!account.value || account.value.teamId !== teamId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.BAD_REQUEST(),
            message: "Conta bancária inválida.",
         });
      }
      if (account.value.initialBalanceDate && refs.date) {
         const txDate = dayjs(refs.date);
         const balanceDate = dayjs(account.value.initialBalanceDate);
         if (txDate.isBefore(balanceDate)) {
            throw new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.BAD_REQUEST(),
               message: `Não é possível registrar lançamentos antes da data do saldo inicial (${balanceDate.format("DD/MM/YYYY")}).`,
            });
         }
      }
   }

   if (refs.destinationBankAccountId) {
      const dest = await Result.tryPromise({
         try: () =>
            db.query.bankAccounts.findFirst({
               where: (f, { eq }) =>
                  eq(f.id, refs.destinationBankAccountId ?? ""),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar conta de destino.",
            }),
      });
      if (Result.isError(dest)) throw dest.error;
      if (!dest.value || dest.value.teamId !== teamId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.BAD_REQUEST(),
            message: "Conta de destino inválida.",
         });
      }
      if (dest.value.initialBalanceDate && refs.date) {
         const txDate = dayjs(refs.date);
         const balanceDate = dayjs(dest.value.initialBalanceDate);
         if (txDate.isBefore(balanceDate)) {
            throw new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.BAD_REQUEST(),
               message: `Não é possível registrar lançamentos antes da data do saldo inicial da conta de destino (${balanceDate.format("DD/MM/YYYY")}).`,
            });
         }
      }
   }

   if (refs.categoryId) {
      const cat = await Result.tryPromise({
         try: () =>
            db.query.categories.findFirst({
               where: (f, { eq }) => eq(f.id, refs.categoryId ?? ""),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar categoria.",
            }),
      });
      if (Result.isError(cat)) throw cat.error;
      if (!cat.value || cat.value.teamId !== teamId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.BAD_REQUEST(),
            message: "Categoria inválida.",
         });
      }
      if (cat.value.isArchived) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.BAD_REQUEST(),
            message: "Categoria arquivada.",
         });
      }
   }

   if (refs.tagId) {
      const tag = await Result.tryPromise({
         try: () =>
            db.query.tags.findFirst({
               where: (f, { eq }) => eq(f.id, refs.tagId ?? ""),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar Centro de Custo.",
            }),
      });
      if (Result.isError(tag)) throw tag.error;
      if (!tag.value || tag.value.teamId !== teamId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.BAD_REQUEST(),
            message: "Centro de Custo inválido.",
         });
      }
   }

   if (refs.relationshipId) {
      const relationship = await Result.tryPromise({
         try: () =>
            db.query.parties.findFirst({
               where: (f, { eq }) => eq(f.id, refs.relationshipId ?? ""),
            }),
         catch: () =>
            new CashbookMiddlewareError({
               error: cashbookMiddlewareErrors.INTERNAL(),
               message: "Falha ao verificar relacionamento.",
            }),
      });
      if (Result.isError(relationship)) throw relationship.error;
      if (!relationship.value || relationship.value.teamId !== teamId) {
         throw new CashbookMiddlewareError({
            error: cashbookMiddlewareErrors.BAD_REQUEST(),
            message: "Relacionamento inválido.",
         });
      }
   }
}
