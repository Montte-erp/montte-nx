import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";
import { Result } from "better-result";
import { os } from "@orpc/server";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { transactions } from "@core/database/schemas/transactions";
import {
   CashbookError,
   cashbookErrors,
} from "@modules/cashbook/cashbook-error";
const base = os.$context<ORPCContextWithOrganization>();

export const requireBankAccount = base.middleware(
   async ({ context, next }, id: string) => {
      const account = await Result.tryPromise({
         try: () =>
            context.db.query.bankAccounts.findFirst({
               where: (f, { eq }) => eq(f.id, id),
            }),
         catch: () =>
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao verificar permissão.",
            }),
      });
      if (Result.isError(account)) throw account.error;
      if (!account.value || account.value.teamId !== context.teamId) {
         throw new CashbookError({
            error: cashbookErrors.NOT_FOUND(),
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
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao verificar permissão.",
            }),
      });
      if (Result.isError(transaction)) throw transaction.error;
      if (!transaction.value || transaction.value.teamId !== context.teamId) {
         throw new CashbookError({
            error: cashbookErrors.NOT_FOUND(),
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
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao verificar recorrência.",
            }),
      });
      if (Result.isError(recurrence)) throw recurrence.error;
      if (!recurrence.value || recurrence.value.teamId !== context.teamId) {
         throw new CashbookError({
            error: cashbookErrors.NOT_FOUND(),
            message: "Recorrência não encontrada.",
         });
      }
      return next({ context: { recurrence: recurrence.value } });
   },
);

export const requireOwnedTransactionIds = base.middleware(
   async ({ context, next }, ids: string[]) => {
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
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao verificar permissão.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (result.value.length !== ids.length) {
         throw new CashbookError({
            error: cashbookErrors.NOT_FOUND(),
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
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao verificar configurações.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (result.value?.costCenterRequired && !tagId) {
         throw new CashbookError({
            error: cashbookErrors.FORBIDDEN(),
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
   date?: Date | string | null;
};

export async function requireValidFinancialReferences(
   db: ORPCContextWithOrganization["db"],
   teamId: string,
   refs: FinancialReferences,
) {
   if (refs.bankAccountId) {
      const account = await db.query.bankAccounts.findFirst({
         where: (f, { eq }) => eq(f.id, refs.bankAccountId ?? ""),
      });
      if (!account || account.teamId !== teamId) {
         throw new CashbookError({
            error: cashbookErrors.BAD_REQUEST(),
            message: "Conta bancária inválida.",
         });
      }
      if (account.initialBalanceDate && refs.date) {
         const txDate = dayjs(refs.date);
         const balanceDate = dayjs(account.initialBalanceDate);
         if (txDate.isBefore(balanceDate)) {
            throw new CashbookError({
               error: cashbookErrors.BAD_REQUEST(),
               message: `Não é possível registrar lançamentos antes da data do saldo inicial (${balanceDate.format("DD/MM/YYYY")}).`,
            });
         }
      }
   }

   if (refs.destinationBankAccountId) {
      const dest = await db.query.bankAccounts.findFirst({
         where: (f, { eq }) => eq(f.id, refs.destinationBankAccountId ?? ""),
      });
      if (!dest || dest.teamId !== teamId) {
         throw new CashbookError({
            error: cashbookErrors.BAD_REQUEST(),
            message: "Conta de destino inválida.",
         });
      }
      if (dest.initialBalanceDate && refs.date) {
         const txDate = dayjs(refs.date);
         const balanceDate = dayjs(dest.initialBalanceDate);
         if (txDate.isBefore(balanceDate)) {
            throw new CashbookError({
               error: cashbookErrors.BAD_REQUEST(),
               message: `Não é possível registrar lançamentos antes da data do saldo inicial da conta de destino (${balanceDate.format("DD/MM/YYYY")}).`,
            });
         }
      }
   }

   if (refs.categoryId) {
      const cat = await db.query.categories.findFirst({
         where: (f, { eq }) => eq(f.id, refs.categoryId ?? ""),
      });
      if (!cat || cat.teamId !== teamId) {
         throw new CashbookError({
            error: cashbookErrors.BAD_REQUEST(),
            message: "Categoria inválida.",
         });
      }
      if (cat.isArchived) {
         throw new CashbookError({
            error: cashbookErrors.BAD_REQUEST(),
            message: "Categoria arquivada.",
         });
      }
   }

   if (refs.tagId) {
      const tag = await db.query.tags.findFirst({
         where: (f, { eq }) => eq(f.id, refs.tagId ?? ""),
      });
      if (!tag || tag.teamId !== teamId) {
         throw new CashbookError({
            error: cashbookErrors.BAD_REQUEST(),
            message: "Centro de Custo inválido.",
         });
      }
   }
}
