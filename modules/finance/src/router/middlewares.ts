import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { os } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { transactions } from "@core/database/schemas/transactions";
const base = os.$context<ORPCContextWithOrganization>();

export const requireBankAccount = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.bankAccounts.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((account) =>
         !account || account.teamId !== context.teamId
            ? err(WebAppError.notFound("Conta bancária não encontrada."))
            : ok(account),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { bankAccount: result.value } });
   },
);

export const requireCreditCard = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.creditCards.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((card) =>
         !card || card.teamId !== context.teamId
            ? err(WebAppError.notFound("Cartão de crédito não encontrado."))
            : ok(card),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { creditCard: result.value } });
   },
);

export const requireTransaction = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.transactions.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((transaction) =>
         !transaction || transaction.teamId !== context.teamId
            ? err(WebAppError.notFound("Lançamento não encontrado."))
            : ok(transaction),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { transaction: result.value } });
   },
);

export const requireOwnedTransactionIds = base.middleware(
   async ({ context, next }, ids: string[]) => {
      const result = await fromPromise(
         context.db
            .select({ id: transactions.id })
            .from(transactions)
            .where(
               and(
                  inArray(transactions.id, ids),
                  eq(transactions.teamId, context.teamId),
               ),
            ),
         () => WebAppError.internal("Falha ao verificar permissão."),
      );
      if (result.isErr()) throw result.error;
      if (result.value.length !== ids.length) {
         throw WebAppError.notFound("Um ou mais lançamentos não encontrados.");
      }
      return next();
   },
);

export const enforceCostCenterPolicy = base.middleware(
   async ({ context, next }, tagId: string | null | undefined) => {
      const result = await fromPromise(
         context.db.query.financialConfig.findFirst({
            where: (f, { eq }) => eq(f.teamId, context.teamId),
         }),
         () => WebAppError.internal("Falha ao verificar configurações."),
      );
      if (result.isErr()) throw result.error;
      if (result.value?.costCenterRequired && !tagId) {
         throw WebAppError.forbidden(
            "Centro de Custo é obrigatório para este espaço.",
         );
      }
      return next();
   },
);

export type FinancialReferences = {
   bankAccountId?: string | null;
   destinationBankAccountId?: string | null;
   categoryId?: string | null;
   contactId?: string | null;
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
         throw WebAppError.badRequest("Conta bancária inválida.");
      }
      if (account.initialBalanceDate && refs.date) {
         const txDate = dayjs(refs.date);
         const balanceDate = dayjs(account.initialBalanceDate);
         if (txDate.isBefore(balanceDate)) {
            throw WebAppError.badRequest(
               `Não é possível registrar lançamentos antes da data do saldo inicial (${balanceDate.format("DD/MM/YYYY")}).`,
            );
         }
      }
   }

   if (refs.destinationBankAccountId) {
      const dest = await db.query.bankAccounts.findFirst({
         where: (f, { eq }) => eq(f.id, refs.destinationBankAccountId ?? ""),
      });
      if (!dest || dest.teamId !== teamId) {
         throw WebAppError.badRequest("Conta de destino inválida.");
      }
      if (dest.initialBalanceDate && refs.date) {
         const txDate = dayjs(refs.date);
         const balanceDate = dayjs(dest.initialBalanceDate);
         if (txDate.isBefore(balanceDate)) {
            throw WebAppError.badRequest(
               `Não é possível registrar lançamentos antes da data do saldo inicial da conta de destino (${balanceDate.format("DD/MM/YYYY")}).`,
            );
         }
      }
   }

   if (refs.categoryId) {
      const cat = await db.query.categories.findFirst({
         where: (f, { eq }) => eq(f.id, refs.categoryId ?? ""),
      });
      if (!cat || cat.teamId !== teamId) {
         throw WebAppError.badRequest("Categoria inválida.");
      }
   }

   if (refs.tagId) {
      const tag = await db.query.tags.findFirst({
         where: (f, { eq }) => eq(f.id, refs.tagId ?? ""),
      });
      if (!tag || tag.teamId !== teamId) {
         throw WebAppError.badRequest("Centro de Custo inválido.");
      }
   }

   if (refs.contactId) {
      const contact = await db.query.contacts.findFirst({
         where: (f, { eq }) => eq(f.id, refs.contactId ?? ""),
      });
      if (!contact || contact.teamId !== teamId) {
         throw WebAppError.badRequest("Contato inválido.");
      }
   }
}
