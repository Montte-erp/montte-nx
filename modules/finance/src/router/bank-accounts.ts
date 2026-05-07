import dayjs from "dayjs";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
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

const BANK_ACCOUNT_TYPES = [
   "checking",
   "savings",
   "investment",
   "payment",
   "cash",
] as const;

const listSchema = z.object({
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(1000).catch(20).default(20),
   search: z.string().max(100).optional(),
   type: z.enum(BANK_ACCOUNT_TYPES).optional(),
});

export const list = protectedProcedure
   .input(listSchema)
   .handler(async ({ context, input }) => {
      const { page, pageSize, search, type } = input;
      const offset = (page - 1) * pageSize;
      const where = and(
         eq(bankAccounts.teamId, context.teamId),
         eq(bankAccounts.status, "active"),
         type ? eq(bankAccounts.type, type) : undefined,
         search ? ilike(bankAccounts.name, `%${search}%`) : undefined,
      );

      const result = await fromPromise(
         Promise.all([
            context.db.query.bankAccounts.findMany({
               where: () => where,
               orderBy: (f, { asc }) => [asc(f.name)],
               limit: pageSize,
               offset,
            }),
            context.db
               .select({ count: sql<number>`cast(count(*) as int)` })
               .from(bankAccounts)
               .where(where),
         ]),
         () => WebAppError.internal("Falha ao listar contas bancárias."),
      );
      if (result.isErr()) throw result.error;
      const [rows, countRows] = result.value;
      const totalCount = countRows[0]?.count ?? 0;

      const data = await Promise.all(
         rows.map(async (account) => {
            const balances = await computeBankAccountBalance(
               context.db,
               account.id,
               account.initialBalance,
            );
            return { ...account, ...balances };
         }),
      );

      return {
         data,
         totalCount,
         page,
         pageSize,
         totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      };
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

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
   .handler(async ({ context, input }) => {
      const owned = await fromPromise(
         context.db.query.bankAccounts.findMany({
            where: (f, { and, eq, inArray: inArr }) =>
               and(eq(f.teamId, context.teamId), inArr(f.id, input.ids)),
            columns: { id: true },
         }),
         () => WebAppError.internal("Falha ao verificar contas bancárias."),
      );
      if (owned.isErr()) throw owned.error;
      if (owned.value.length !== input.ids.length) {
         throw WebAppError.notFound(
            "Uma ou mais contas bancárias não encontradas.",
         );
      }

      const usage = await fromPromise(
         context.db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(
               or(
                  inArray(transactions.bankAccountId, input.ids),
                  inArray(transactions.destinationBankAccountId, input.ids),
               ),
            ),
         () =>
            WebAppError.internal(
               "Falha ao verificar lançamentos das contas bancárias.",
            ),
      );
      if (usage.isErr()) throw usage.error;
      if ((usage.value[0]?.count ?? 0) > 0) {
         throw WebAppError.conflict(
            "Uma ou mais contas têm lançamentos e não podem ser excluídas. Use arquivamento.",
         );
      }

      const deleted = await fromPromise(
         context.db.transaction(async (tx) =>
            tx.delete(bankAccounts).where(inArray(bankAccounts.id, input.ids)),
         ),
         () => WebAppError.internal("Falha ao excluir contas bancárias."),
      );
      if (deleted.isErr()) throw deleted.error;
      return { deleted: input.ids.length };
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
