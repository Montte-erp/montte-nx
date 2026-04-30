import dayjs from "dayjs";
import { and, eq, or, sql } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { add, of, subtract, toDecimal } from "@f-o-t/money";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import {
   bankAccounts,
   createBankAccountSchema,
   updateBankAccountSchema,
} from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireBankAccount } from "@modules/finance/router/middlewares";

const idSchema = z.object({ id: z.string().uuid() });

async function computeBalance(
   db: DatabaseInstance,
   accountId: string,
   initialBalance: string,
) {
   const currency = "BRL";

   const [row] = await db
      .select({
         income: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount::numeric ELSE 0 END), 0)`,
         expense: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount::numeric ELSE 0 END), 0)`,
         transferOut: sql<string>`COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount::numeric ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.bankAccountId, accountId));

   const [transferInRow] = await db
      .select({
         transferIn: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
      })
      .from(transactions)
      .where(
         and(
            eq(transactions.destinationBankAccountId, accountId),
            eq(transactions.type, "transfer"),
         ),
      );

   let balance = of(initialBalance, currency);
   balance = add(balance, of(row?.income ?? "0", currency));
   balance = subtract(balance, of(row?.expense ?? "0", currency));
   balance = subtract(balance, of(row?.transferOut ?? "0", currency));
   balance = add(balance, of(transferInRow?.transferIn ?? "0", currency));

   const [pendingRow] = await db
      .select({
         pendingReceivable: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' AND status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
         pendingPayable: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.bankAccountId, accountId));

   let projected = balance;
   projected = add(
      projected,
      of(pendingRow?.pendingReceivable ?? "0", currency),
   );
   projected = subtract(
      projected,
      of(pendingRow?.pendingPayable ?? "0", currency),
   );

   return {
      currentBalance: toDecimal(balance),
      projectedBalance: toDecimal(projected),
   };
}

export const create = protectedProcedure
   .input(createBankAccountSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .insert(bankAccounts)
            .values({ ...input, teamId: context.teamId })
            .returning(),
         () => WebAppError.internal("Falha ao criar conta bancária."),
      );
      if (result.isErr()) throw result.error;
      const [account] = result.value;
      if (!account)
         throw WebAppError.internal("Falha ao criar conta bancária.");
      return account;
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.bankAccounts.findMany({
         where: (f, { and, eq }) =>
            and(eq(f.teamId, context.teamId), eq(f.status, "active")),
         orderBy: (f, { asc }) => [asc(f.name)],
      }),
      () => WebAppError.internal("Falha ao listar contas bancárias."),
   );
   if (result.isErr()) throw result.error;

   return Promise.all(
      result.value.map(async (account) => {
         const balances = await computeBalance(
            context.db,
            account.id,
            account.initialBalance,
         );
         return { ...account, ...balances };
      }),
   );
});

export const getById = protectedProcedure
   .input(idSchema)
   .use(requireBankAccount, (input) => input.id)
   .handler(async ({ context }) => {
      const balances = await computeBalance(
         context.db,
         context.bankAccount.id,
         context.bankAccount.initialBalance,
      );
      return { ...context.bankAccount, ...balances };
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateBankAccountSchema))
   .use(requireBankAccount, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db
            .update(bankAccounts)
            .set({ ...data, updatedAt: dayjs().toDate() })
            .where(eq(bankAccounts.id, id))
            .returning(),
         () => WebAppError.internal("Falha ao atualizar conta bancária."),
      );
      if (result.isErr()) throw result.error;
      const [updated] = result.value;
      if (!updated)
         throw WebAppError.notFound("Conta bancária não encontrada.");
      return updated;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireBankAccount, (input) => input.id)
   .handler(async ({ context, input }) => {
      const usage = await fromPromise(
         context.db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(
               or(
                  eq(transactions.bankAccountId, input.id),
                  eq(transactions.destinationBankAccountId, input.id),
               ),
            ),
         () =>
            WebAppError.internal(
               "Falha ao verificar lançamentos da conta bancária.",
            ),
      ).andThen(([row]) =>
         (row?.count ?? 0) > 0
            ? err(
                 WebAppError.conflict(
                    "Conta com lançamentos não pode ser excluída. Use arquivamento.",
                 ),
              )
            : ok(undefined),
      );
      if (usage.isErr()) throw usage.error;

      const deleted = await fromPromise(
         context.db.delete(bankAccounts).where(eq(bankAccounts.id, input.id)),
         () => WebAppError.internal("Falha ao excluir conta bancária."),
      );
      if (deleted.isErr()) throw deleted.error;
      return { success: true };
   });

export const bulkCreate = protectedProcedure
   .input(
      z.object({
         accounts: z.array(createBankAccountSchema).min(1).max(500),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .insert(bankAccounts)
            .values(
               input.accounts.map((a) => ({ ...a, teamId: context.teamId })),
            )
            .returning(),
         () => WebAppError.internal("Falha ao importar contas bancárias."),
      );
      if (result.isErr()) throw result.error;
      return { created: result.value.length };
   });
