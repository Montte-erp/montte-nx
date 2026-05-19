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
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import {
   bankAccounts,
   createBankAccountSchema,
   updateBankAccountSchema,
} from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import { log } from "@core/logging";
import { protectedProcedure } from "@core/orpc/server";
import { requireBankAccount } from "@modules/cashbook/router/middlewares";
import {
   buildBankAccountBalanceSql,
   computeBankAccountBalance,
   computeBankAccountBalances,
} from "@modules/cashbook/bank-accounts";

const bankAccountRouterErrors = defineErrorCatalog(
   "cashbook.router.bankAccounts",
   {
      CONFLICT: {
         status: 409,
         message: "Conflito em conta bancária.",
         tags: ["cashbook"],
      },
      INTERNAL: {
         status: 500,
         message: "Falha interna em conta bancária.",
         tags: ["cashbook"],
      },
      NOT_FOUND: {
         status: 404,
         message: "Conta bancária não encontrada.",
         tags: ["cashbook"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cashbook.router.bankAccounts": typeof bankAccountRouterErrors;
   }
}

type BankAccountRouterCatalogError =
   | ReturnType<typeof bankAccountRouterErrors.CONFLICT>
   | ReturnType<typeof bankAccountRouterErrors.INTERNAL>
   | ReturnType<typeof bankAccountRouterErrors.NOT_FOUND>;

class BankAccountRouterError extends TaggedError("BankAccountRouterError")<{
   error: BankAccountRouterCatalogError;
   internal?: { detail: string };
   message: string;
}>() {}

const idSchema = z.object({ id: z.string().uuid() });
export const create = protectedProcedure
   .input(createBankAccountSchema)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .insert(bankAccounts)
                  .values({ ...input, teamId: context.teamId })
                  .returning(),
            ),
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao criar conta bancária.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [account] = result.value;
      if (!account) {
         throw new BankAccountRouterError({
            error: bankAccountRouterErrors.INTERNAL(),
            message: "Falha ao criar conta bancária.",
         });
      }
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
   const rules = (() => {
      if (sorting?.length) return sorting;
      return [defaultBankAccountSort];
   })();
   const orderBy: SQL[] = [];

   for (const sort of rules) {
      const direction = (() => {
         if (sort.desc) return desc;
         return asc;
      })();
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
         (() => {
            if (type) return eq(bankAccounts.type, type);
            return undefined;
         })(),
         (() => {
            if (search) return ilike(bankAccounts.name, `%${search}%`);
            return undefined;
         })(),
      );

      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao listar contas bancárias.",
            }),
      });
      if (Result.isError(result)) throw result.error;
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
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.bankAccounts.findMany({
            where: (f, { and, eq }) =>
               and(eq(f.teamId, context.teamId), eq(f.status, "active")),
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
      catch: () =>
         new BankAccountRouterError({
            error: bankAccountRouterErrors.INTERNAL(),
            message: "Falha ao listar contas bancárias.",
         }),
   });
   if (Result.isError(result)) throw result.error;

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
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(bankAccounts)
                  .set({ ...data, updatedAt: dayjs().toDate() })
                  .where(eq(bankAccounts.id, id))
                  .returning(),
            ),
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao atualizar conta bancária.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [updated] = result.value;
      if (!updated) {
         throw new BankAccountRouterError({
            error: bankAccountRouterErrors.NOT_FOUND(),
            message: "Conta bancária não encontrada.",
         });
      }
      return updated;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireBankAccount, (input) => input.id)
   .handler(async ({ context, input }) => {
      const usage = await Result.tryPromise({
         try: () =>
            context.db
               .select({ count: sql<number>`count(*)::int` })
               .from(transactions)
               .where(
                  or(
                     eq(transactions.bankAccountId, input.id),
                     eq(transactions.destinationBankAccountId, input.id),
                  ),
               ),
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao verificar lançamentos da conta bancária.",
            }),
      });
      if (Result.isError(usage)) throw usage.error;
      if ((usage.value[0]?.count ?? 0) > 0) {
         throw new BankAccountRouterError({
            error: bankAccountRouterErrors.CONFLICT(),
            message:
               "Conta com lançamentos não pode ser excluída. Use arquivamento.",
         });
      }

      const deleted = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx.delete(bankAccounts).where(eq(bankAccounts.id, input.id)),
            ),
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao excluir conta bancária.",
            }),
      });
      if (Result.isError(deleted)) throw deleted.error;
      return { success: true };
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
   .handler(async ({ context, input }) => {
      const owned = await Result.tryPromise({
         try: () =>
            context.db.query.bankAccounts.findMany({
               where: (f, { and, eq, inArray: inArr }) =>
                  and(eq(f.teamId, context.teamId), inArr(f.id, input.ids)),
               columns: { id: true },
            }),
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao verificar contas bancárias.",
            }),
      });
      if (Result.isError(owned)) throw owned.error;
      if (owned.value.length !== input.ids.length) {
         throw new BankAccountRouterError({
            error: bankAccountRouterErrors.NOT_FOUND(),
            message: "Uma ou mais contas bancárias não encontradas.",
         });
      }

      const usage = await Result.tryPromise({
         try: () =>
            context.db
               .select({ count: sql<number>`count(*)::int` })
               .from(transactions)
               .where(
                  or(
                     inArray(transactions.bankAccountId, input.ids),
                     inArray(transactions.destinationBankAccountId, input.ids),
                  ),
               ),
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao verificar lançamentos das contas bancárias.",
            }),
      });
      if (Result.isError(usage)) throw usage.error;
      if ((usage.value[0]?.count ?? 0) > 0) {
         throw new BankAccountRouterError({
            error: bankAccountRouterErrors.CONFLICT(),
            message:
               "Uma ou mais contas têm lançamentos e não podem ser excluídas. Use arquivamento.",
         });
      }

      const deleted = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .delete(bankAccounts)
                  .where(inArray(bankAccounts.id, input.ids)),
            ),
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao excluir contas bancárias.",
            }),
      });
      if (Result.isError(deleted)) throw deleted.error;
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
   const cached = await Result.tryPromise({
      try: () => redis.get(BANKS_REDIS_KEY),
      catch: (error) =>
         new BankAccountRouterError({
            error: bankAccountRouterErrors.INTERNAL(),
            message: "Falha ao ler cache da lista de bancos.",
            internal: { detail: String(error) },
         }),
   });
   if (Result.isError(cached)) {
      log.warn({
         module: "finance.bank-accounts",
         message: "Falha ao ler cache da lista de bancos",
         err: cached.error.internal?.detail,
         key: BANKS_REDIS_KEY,
      });
   }
   if (Result.isOk(cached) && cached.value) {
      const cachedPayload = cached.value;
      const parsed = Result.try({
         try: () => BrasilApiBankArraySchema.parse(JSON.parse(cachedPayload)),
         catch: (error) =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao interpretar cache da lista de bancos.",
               internal: { detail: String(error) },
            }),
      });
      if (Result.isOk(parsed)) return withFallbackBanks(parsed.value);
      log.warn({
         module: "finance.bank-accounts",
         message:
            "Falha ao interpretar cache da lista de bancos com BrasilApiBankArraySchema",
         err: parsed.error.internal?.detail,
         key: BANKS_REDIS_KEY,
      });
   }

   const responseResult = await Result.tryPromise({
      try: () =>
         fetch("https://brasilapi.com.br/api/banks/v1", {
            signal: AbortSignal.timeout(5000),
         }),
      catch: (error) =>
         new BankAccountRouterError({
            error: bankAccountRouterErrors.INTERNAL(),
            message: "Falha ao buscar bancos na BrasilAPI.",
            internal: { detail: String(error) },
         }),
   });
   if (Result.isError(responseResult)) {
      log.error({
         module: "finance.bank-accounts",
         message:
            "Falha ao buscar bancos na BrasilAPI, retornando FALLBACK_BANKS",
         err: responseResult.error.internal?.detail,
         fallbackCount: FALLBACK_BANKS.length,
      });
      return FALLBACK_BANKS;
   }
   if (!responseResult.value.ok) {
      log.warn({
         module: "finance.bank-accounts",
         message:
            "Lista de bancos da BrasilAPI retornou resposta sem sucesso, retornando FALLBACK_BANKS",
         status: responseResult.value.status,
         statusText: responseResult.value.statusText,
         fallbackCount: FALLBACK_BANKS.length,
      });
      return FALLBACK_BANKS;
   }

   const jsonResult = await Result.tryPromise({
      try: () => responseResult.value.json(),
      catch: (error) =>
         new BankAccountRouterError({
            error: bankAccountRouterErrors.INTERNAL(),
            message: "Falha ao interpretar JSON da lista de bancos.",
            internal: { detail: String(error) },
         }),
   });
   if (Result.isError(jsonResult)) {
      log.error({
         module: "finance.bank-accounts",
         message:
            "Falha ao interpretar JSON da lista de bancos da BrasilAPI, retornando FALLBACK_BANKS",
         err: jsonResult.error.internal?.detail,
         fallbackCount: FALLBACK_BANKS.length,
      });
      return FALLBACK_BANKS;
   }

   const parsed = BrasilApiBankArraySchema.safeParse(jsonResult.value);
   if (!parsed.success) {
      log.error({
         module: "finance.bank-accounts",
         message:
            "Lista de bancos da BrasilAPI falhou na validação de schema, retornando FALLBACK_BANKS",
         err: parsed.error,
         schema: "BrasilApiBankArraySchema",
         fallbackCount: FALLBACK_BANKS.length,
      });
      return FALLBACK_BANKS;
   }

   const cacheResult = await Result.tryPromise({
      try: () =>
         redis.set(
            BANKS_REDIS_KEY,
            JSON.stringify(parsed.data),
            "EX",
            BANKS_CACHE_TTL_SEC,
         ),
      catch: (error) =>
         new BankAccountRouterError({
            error: bankAccountRouterErrors.INTERNAL(),
            message: "Falha ao persistir lista de bancos da BrasilAPI.",
            internal: { detail: String(error) },
         }),
   });
   if (Result.isError(cacheResult)) {
      log.warn({
         module: "finance.bank-accounts",
         message:
            "Falha ao persistir lista de bancos da BrasilAPI com redis.set",
         err: cacheResult.error.internal?.detail,
         key: BANKS_REDIS_KEY,
      });
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
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .insert(bankAccounts)
                  .values(
                     input.accounts.map((a) => ({
                        ...a,
                        teamId: context.teamId,
                     })),
                  )
                  .returning(),
            ),
         catch: () =>
            new BankAccountRouterError({
               error: bankAccountRouterErrors.INTERNAL(),
               message: "Falha ao importar contas bancárias.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { created: result.value.length };
   });
