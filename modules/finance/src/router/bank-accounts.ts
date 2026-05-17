import dayjs from "dayjs";
import {
   and,
   asc,
   desc,
   eq,
   getTableColumns,
   ilike,
   inArray,
   or,
   sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { err, fromPromise, fromThrowable, ok } from "neverthrow";
import { z } from "zod";
import {
   bankAccounts,
   createBankAccountSchema,
   updateBankAccountSchema,
} from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { getLogger } from "@core/logging";
import { protectedProcedure } from "@core/orpc/server";
import { requireBankAccount } from "@modules/finance/router/middlewares";
import {
   buildBankAccountBalanceSql,
   computeBankAccountBalance,
   computeBankAccountBalances,
} from "@modules/finance/services/bank-account-balance";

const idSchema = z.object({ id: z.string().uuid() });
const logger = getLogger();

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
   pageSize: z.number().int().positive().max(100).catch(20).default(20),
   search: z.string().max(100).optional(),
   type: z.enum(BANK_ACCOUNT_TYPES).optional(),
   sorting: z
      .array(
         z.object({
            id: z.enum([
               "currentBalance",
               "initialBalance",
               "name",
               "projectedBalance",
               "type",
            ]),
            desc: z.boolean(),
         }),
      )
      .max(5)
      .optional(),
});

type ListSorting = z.infer<typeof listSchema>["sorting"];
type BankAccountSortRule = NonNullable<ListSorting>[number];

const defaultBankAccountSort: BankAccountSortRule = {
   id: "name",
   desc: false,
};

const currentBalanceSql = buildBankAccountBalanceSql(false);
const projectedBalanceSql = buildBankAccountBalanceSql(true);

function buildBankAccountOrderBy(sorting: ListSorting): SQL[] {
   const rules = sorting?.length ? sorting : [defaultBankAccountSort];
   const orderBy: SQL[] = [];

   for (const sort of rules) {
      const direction = sort.desc ? desc : asc;
      switch (sort.id) {
         case "currentBalance":
            orderBy.push(direction(currentBalanceSql));
            break;
         case "initialBalance":
            orderBy.push(direction(bankAccounts.initialBalance));
            break;
         case "name":
            orderBy.push(direction(bankAccounts.name));
            break;
         case "projectedBalance":
            orderBy.push(direction(projectedBalanceSql));
            break;
         case "type":
            orderBy.push(direction(bankAccounts.type));
            break;
      }
   }

   return [...orderBy, asc(bankAccounts.id)];
}

export const list = protectedProcedure
   .input(listSchema)
   .handler(async ({ context, input }) => {
      const { page, pageSize, search, sorting, type } = input;
      const offset = (page - 1) * pageSize;
      const where = and(
         eq(bankAccounts.teamId, context.teamId),
         eq(bankAccounts.status, "active"),
         type ? eq(bankAccounts.type, type) : undefined,
         search ? ilike(bankAccounts.name, `%${search}%`) : undefined,
      );

      const result = await fromPromise(
         Promise.all([
            context.db
               .select(getTableColumns(bankAccounts))
               .from(bankAccounts)
               .leftJoin(
                  transactions,
                  and(
                     or(
                        eq(transactions.bankAccountId, bankAccounts.id),
                        eq(
                           transactions.destinationBankAccountId,
                           bankAccounts.id,
                        ),
                     ),
                     eq(transactions.ignored, false),
                  ),
               )
               .where(where)
               .groupBy(bankAccounts.id)
               .orderBy(...buildBankAccountOrderBy(sorting))
               .limit(pageSize)
               .offset(offset),
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

      const balances = await computeBankAccountBalances(context.db, rows);
      const data = rows.map((account) => ({
         ...account,
         currentBalance:
            balances.get(account.id)?.currentBalance ?? account.initialBalance,
         projectedBalance:
            balances.get(account.id)?.projectedBalance ??
            account.initialBalance,
      }));

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

   const balances = await computeBankAccountBalances(context.db, result.value);
   return result.value.map((account) => ({
      ...account,
      currentBalance:
         balances.get(account.id)?.currentBalance ?? account.initialBalance,
      projectedBalance:
         balances.get(account.id)?.projectedBalance ?? account.initialBalance,
   }));
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

const BrasilApiBankSchema = z.object({
   ispb: z.string(),
   name: z.string().nullable(),
   code: z.number().nullable(),
   fullName: z.string().nullable(),
});

const BrasilApiBankArraySchema = z.array(BrasilApiBankSchema);

const BANKS_REDIS_KEY = "finance:brasilapi:banks:v1";
const BANKS_CACHE_TTL_SEC = 30 * 24 * 60 * 60;
const FALLBACK_BANKS = [
   {
      ispb: "60701190",
      name: "ITAÚ UNIBANCO S.A.",
      code: 341,
      fullName: "ITAÚ UNIBANCO S.A.",
   },
   {
      ispb: "18236120",
      name: "NUBANK",
      code: 260,
      fullName: "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
   },
   {
      ispb: "90400888",
      name: "BANCO SANTANDER (BRASIL) S.A.",
      code: 33,
      fullName: "BANCO SANTANDER (BRASIL) S.A.",
   },
   {
      ispb: "60746948",
      name: "BANCO BRADESCO S.A.",
      code: 237,
      fullName: "BANCO BRADESCO S.A.",
   },
   {
      ispb: "00000000",
      name: "BANCO DO BRASIL S.A.",
      code: 1,
      fullName: "BANCO DO BRASIL S.A.",
   },
   {
      ispb: "00360305",
      name: "CAIXA ECONOMICA FEDERAL",
      code: 104,
      fullName: "CAIXA ECONOMICA FEDERAL",
   },
] satisfies BrasilApiBank[];

function withFallbackBanks(banks: BrasilApiBank[]) {
   const byCode = new Map<string, BrasilApiBank>();
   for (const bank of [...FALLBACK_BANKS, ...banks]) {
      if (!bank.code) continue;
      byCode.set(String(bank.code).padStart(3, "0"), bank);
   }
   return Array.from(byCode.values());
}

async function fetchBanks(
   redis: import("@core/redis/connection").Redis,
): Promise<BrasilApiBank[]> {
   const cached = await fromPromise(redis.get(BANKS_REDIS_KEY), (e) => e);
   if (cached.isErr()) {
      logger.warn(
         { err: cached.error, key: BANKS_REDIS_KEY },
         "Falha ao ler cache da lista de bancos",
      );
   }
   if (cached.isOk() && cached.value) {
      const cachedPayload = cached.value;
      const parsed = fromThrowable(
         () => BrasilApiBankArraySchema.parse(JSON.parse(cachedPayload)),
         (e) => e,
      )();
      if (parsed.isOk()) return withFallbackBanks(parsed.value);
      logger.warn(
         { err: parsed.error, key: BANKS_REDIS_KEY },
         "Falha ao interpretar cache da lista de bancos com BrasilApiBankArraySchema",
      );
   }

   const responseResult = await fromPromise(
      fetch("https://brasilapi.com.br/api/banks/v1", {
         signal: AbortSignal.timeout(5000),
      }),
      (e) => e,
   );
   if (responseResult.isErr()) {
      logger.error(
         { err: responseResult.error, fallbackCount: FALLBACK_BANKS.length },
         "Falha ao buscar bancos na BrasilAPI, retornando FALLBACK_BANKS",
      );
      return FALLBACK_BANKS;
   }
   if (!responseResult.value.ok) {
      logger.warn(
         {
            status: responseResult.value.status,
            statusText: responseResult.value.statusText,
            fallbackCount: FALLBACK_BANKS.length,
         },
         "Lista de bancos da BrasilAPI retornou resposta sem sucesso, retornando FALLBACK_BANKS",
      );
      return FALLBACK_BANKS;
   }

   const jsonResult = await fromPromise(responseResult.value.json(), (e) => e);
   if (jsonResult.isErr()) {
      logger.error(
         { err: jsonResult.error, fallbackCount: FALLBACK_BANKS.length },
         "Falha ao interpretar JSON da lista de bancos da BrasilAPI, retornando FALLBACK_BANKS",
      );
      return FALLBACK_BANKS;
   }

   const parsed = BrasilApiBankArraySchema.safeParse(jsonResult.value);
   if (!parsed.success) {
      logger.error(
         {
            err: parsed.error,
            schema: "BrasilApiBankArraySchema",
            fallbackCount: FALLBACK_BANKS.length,
         },
         "Lista de bancos da BrasilAPI falhou na validação de schema, retornando FALLBACK_BANKS",
      );
      return FALLBACK_BANKS;
   }

   const cacheResult = await fromPromise(
      redis.set(
         BANKS_REDIS_KEY,
         JSON.stringify(parsed.data),
         "EX",
         BANKS_CACHE_TTL_SEC,
      ),
      (e) => e,
   );
   if (cacheResult.isErr()) {
      logger.warn(
         { err: cacheResult.error, key: BANKS_REDIS_KEY },
         "Falha ao persistir lista de bancos da BrasilAPI com redis.set",
      );
   }
   return withFallbackBanks(parsed.data);
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
