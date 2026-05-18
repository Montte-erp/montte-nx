import dayjs from "dayjs";
import { Result } from "better-result";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import {
   createCreditCardSchema,
   creditCards,
   updateCreditCardSchema,
} from "@core/database/schemas/credit-cards";
import { protectedProcedure } from "@core/orpc/server";
import {
   buildCreditCardOrderBy,
   CardsRouterError,
   cardsRouterErrors,
   requireCreditCard,
} from "@modules/cards/credit-cards";
import { findBlockingOpenStatement } from "@modules/cards/statements";

const idSchema = z.object({ id: z.string().uuid() });

const listCreditCardsSchema = z.object({
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(1000).catch(20).default(20),
   search: z.string().max(100).optional(),
   status: z.enum(["active", "blocked", "cancelled"]).optional(),
   sorting: z
      .array(
         z.object({
            id: z.enum([
               "bankAccountId",
               "brand",
               "closingDay",
               "creditLimit",
               "dueDay",
               "name",
               "status",
            ]),
            desc: z.boolean(),
         }),
      )
      .max(3, "Use no máximo 3 critérios de ordenação.")
      .optional(),
});

const bulkCreateSchema = z.object({
   cards: z
      .array(
         z.object({
            name: z.string().min(2).max(80),
            creditLimit: z.string(),
            last4: z
               .string()
               .regex(/^\d{4}$/)
               .nullable()
               .optional(),
            closingDay: z.number().int().min(1).max(31),
            dueDay: z.number().int().min(1).max(31),
            bankAccountId: z.string().uuid(),
            status: z.enum(["active", "blocked", "cancelled"]).optional(),
            brand: z
               .enum([
                  "visa",
                  "mastercard",
                  "elo",
                  "amex",
                  "hipercard",
                  "other",
               ])
               .optional(),
            color: z.string().optional(),
         }),
      )
      .min(1)
      .max(500),
});

export const create = protectedProcedure
   .input(createCreditCardSchema)
   .handler(async ({ context, input }) => {
      const created = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .insert(creditCards)
                  .values({ ...input, teamId: context.teamId })
                  .returning(),
            ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao criar cartão de crédito.",
            }),
      });
      if (Result.isError(created)) throw created.error;
      const [card] = created.value;
      if (!card) {
         throw new CardsRouterError({
            error: cardsRouterErrors.INTERNAL(),
            message: "Falha ao criar cartão de crédito.",
         });
      }
      return card;
   });

export const getAll = protectedProcedure
   .input(listCreditCardsSchema)
   .handler(async ({ context, input }) => {
      const { page, pageSize, search, sorting, status } = input;
      const offset = (page - 1) * pageSize;
      const where = and(
         eq(creditCards.teamId, context.teamId),
         status ? eq(creditCards.status, status) : undefined,
         search ? ilike(creditCards.name, `%${search}%`) : undefined,
      );

      const listed = await Result.tryPromise({
         try: () =>
            Promise.all([
               context.db.query.creditCards.findMany({
                  where: () => where,
                  orderBy: () => buildCreditCardOrderBy(sorting),
                  limit: pageSize,
                  offset,
               }),
               context.db
                  .select({ count: sql<number>`cast(count(*) as int)` })
                  .from(creditCards)
                  .where(where),
            ]),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao listar cartões de crédito.",
            }),
      });
      if (Result.isError(listed)) throw listed.error;
      const [data, countResult] = listed.value;
      const totalCount = countResult[0]?.count ?? 0;

      return {
         data,
         totalCount,
         page,
         pageSize,
         totalPages: Math.ceil(totalCount / pageSize),
      };
   });

export const getById = protectedProcedure
   .input(idSchema)
   .use(requireCreditCard, (input) => input.id)
   .handler(async ({ context }) => context.creditCard);

export const update = protectedProcedure
   .input(idSchema.merge(updateCreditCardSchema))
   .use(requireCreditCard, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const updatedResult = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(creditCards)
                  .set({ ...data, updatedAt: dayjs().toDate() })
                  .where(eq(creditCards.id, id))
                  .returning(),
            ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao atualizar cartão de crédito.",
            }),
      });
      if (Result.isError(updatedResult)) throw updatedResult.error;
      const [updated] = updatedResult.value;
      if (!updated) {
         throw new CardsRouterError({
            error: cardsRouterErrors.NOT_FOUND(),
            message: "Cartão de crédito não encontrado.",
         });
      }
      return updated;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireCreditCard, (input) => input.id)
   .handler(async ({ context, input }) => {
      const open = await findBlockingOpenStatement(context.db, [input.id]);
      if (Result.isError(open)) throw open.error;
      if (open.value) {
         throw new CardsRouterError({
            error: cardsRouterErrors.CONFLICT(),
            message: "Cartão com faturas abertas não pode ser excluído.",
         });
      }

      const deleted = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx.delete(creditCards).where(eq(creditCards.id, input.id)),
            ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao excluir cartão de crédito.",
            }),
      });
      if (Result.isError(deleted)) throw deleted.error;
      return { success: true };
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const cardsResult = await Result.tryPromise({
         try: () =>
            context.db.query.creditCards.findMany({
               where: (f, { and }) =>
                  and(inArray(f.id, input.ids), eq(f.teamId, context.teamId)),
            }),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao buscar cartões.",
            }),
      });
      if (Result.isError(cardsResult)) throw cardsResult.error;
      if (cardsResult.value.length !== input.ids.length) {
         throw new CardsRouterError({
            error: cardsRouterErrors.NOT_FOUND(),
            message: "Um ou mais cartões não encontrados.",
         });
      }

      const open = await findBlockingOpenStatement(context.db, input.ids);
      if (Result.isError(open)) throw open.error;
      if (open.value) {
         throw new CardsRouterError({
            error: cardsRouterErrors.CONFLICT(),
            message: `Cartão "${open.value.name}" possui faturas abertas e não pode ser excluído.`,
         });
      }

      const deleted = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx.delete(creditCards).where(inArray(creditCards.id, input.ids)),
            ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao excluir cartões.",
            }),
      });
      if (Result.isError(deleted)) throw deleted.error;
      return { deleted: input.ids.length };
   });

export const bulkCreate = protectedProcedure
   .input(bulkCreateSchema)
   .handler(async ({ context, input }) => {
      const uniqueAccountIds = [
         ...new Set(input.cards.map((c) => c.bankAccountId)),
      ];
      const validAccountsResult = await Result.tryPromise({
         try: () =>
            context.db
               .select({ id: bankAccounts.id })
               .from(bankAccounts)
               .where(
                  and(
                     eq(bankAccounts.teamId, context.teamId),
                     inArray(bankAccounts.id, uniqueAccountIds),
                  ),
               ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao validar contas bancárias.",
            }),
      });
      if (Result.isError(validAccountsResult)) throw validAccountsResult.error;
      const validIds = new Set(validAccountsResult.value.map((a) => a.id));
      if (input.cards.some((c) => !validIds.has(c.bankAccountId))) {
         throw new CardsRouterError({
            error: cardsRouterErrors.BAD_REQUEST(),
            message: "Conta bancária inválida para este time.",
         });
      }

      const rows = input.cards.map((c) => ({
         teamId: context.teamId,
         name: c.name,
         creditLimit: c.creditLimit,
         last4: c.last4,
         closingDay: c.closingDay,
         dueDay: c.dueDay,
         color: c.color ?? "#6366f1",
         status: c.status ?? "active",
         brand: c.brand,
         bankAccountId: c.bankAccountId,
      }));

      const created = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .insert(creditCards)
                  .values(rows)
                  .returning({ id: creditCards.id }),
            ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao importar cartões.",
            }),
      });
      if (Result.isError(created)) throw created.error;
      return { created: created.value.length };
   });
