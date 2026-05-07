import dayjs from "dayjs";
import { eq, or, sql } from "drizzle-orm";
import { err, fromPromise, fromThrowable, ok } from "neverthrow";
import { z } from "zod";
import {
   bankAccounts,
   createBankAccountSchema,
   updateBankAccountSchema,
} from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireBankAccount } from "@modules/finance/router/middlewares";
import { computeBankAccountBalance } from "@modules/finance/services/bank-account-balance";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createBankAccountSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(bankAccounts)
               .values({ ...input, teamId: context.teamId })
               .returning(),
         ),
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
         const balances = await computeBankAccountBalance(
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
      const balances = await computeBankAccountBalance(
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
         context.db.transaction(async (tx) =>
            tx
               .update(bankAccounts)
               .set({ ...data, updatedAt: dayjs().toDate() })
               .where(eq(bankAccounts.id, id))
               .returning(),
         ),
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
         context.db.transaction(async (tx) =>
            tx.delete(bankAccounts).where(eq(bankAccounts.id, input.id)),
         ),
         () => WebAppError.internal("Falha ao excluir conta bancária."),
      );
      if (deleted.isErr()) throw deleted.error;
      return { success: true };
   });

type BrasilApiBank = {
   ispb: string;
   name: string | null;
   code: number | null;
   fullName: string | null;
};

const BANKS_REDIS_KEY = "finance:brasilapi:banks:v1";
const BANKS_CACHE_TTL_SEC = 30 * 24 * 60 * 60;

async function fetchBanks(
   redis: import("@core/redis/connection").Redis,
): Promise<BrasilApiBank[]> {
   const cached = await fromPromise(redis.get(BANKS_REDIS_KEY), () => null);
   if (cached.isOk() && cached.value) {
      const parsed = fromThrowable(
         () => JSON.parse(cached.value as string) as BrasilApiBank[],
         () => null,
      )();
      if (parsed.isOk()) return parsed.value;
   }
   const result = await fromPromise(
      fetch("https://brasilapi.com.br/api/banks/v1", {
         signal: AbortSignal.timeout(5000),
      }).then((r) => r.json() as Promise<BrasilApiBank[]>),
      () => WebAppError.internal("Falha ao consultar bancos."),
   );
   if (result.isErr()) throw result.error;
   await fromPromise(
      redis.set(
         BANKS_REDIS_KEY,
         JSON.stringify(result.value),
         "EX",
         BANKS_CACHE_TTL_SEC,
      ),
      () => null,
   );
   return result.value;
}

export const searchBanks = protectedProcedure
   .input(z.object({ query: z.string().max(80).default("") }))
   .handler(async ({ context, input }) => {
      const banks = await fetchBanks(context.redis);
      const term = input.query.trim().toLowerCase();
      const filtered = term
         ? banks.filter((b) => {
              if (!b.code) return false;
              const haystack =
                 `${b.code} ${b.name ?? ""} ${b.fullName ?? ""}`.toLowerCase();
              return haystack.includes(term);
           })
         : banks.filter((b) => b.code !== null);
      return filtered.map((b) => ({
         code: String(b.code).padStart(3, "0"),
         name: b.name ?? b.fullName ?? "",
         fullName: b.fullName ?? b.name ?? "",
      }));
   });

export const bulkCreate = protectedProcedure
   .input(
      z.object({
         accounts: z.array(createBankAccountSchema).min(1).max(500),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(bankAccounts)
               .values(
                  input.accounts.map((a) => ({ ...a, teamId: context.teamId })),
               )
               .returning(),
         ),
         () => WebAppError.internal("Falha ao importar contas bancárias."),
      );
      if (result.isErr()) throw result.error;
      return { created: result.value.length };
   });
