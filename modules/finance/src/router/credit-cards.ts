import dayjs from "dayjs";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { z } from "zod";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import {
   createCreditCardSchema,
   creditCards,
   updateCreditCardSchema,
} from "@core/database/schemas/credit-cards";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireCreditCard } from "@modules/finance/router/middlewares";

const idSchema = z.object({ id: z.string().uuid() });

const listCreditCardsSchema = z.object({
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(1000).catch(20).default(20),
   search: z.string().max(100).optional(),
   status: z.enum(["active", "blocked", "cancelled"]).optional(),
});

export const create = protectedProcedure
   .input(createCreditCardSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(creditCards)
               .values({ ...input, teamId: context.teamId })
               .returning(),
         ),
         () => WebAppError.internal("Falha ao criar cartão de crédito."),
      );
      if (result.isErr()) throw result.error;
      const [card] = result.value;
      if (!card)
         throw WebAppError.internal("Falha ao criar cartão de crédito.");
      return card;
   });

export const getAll = protectedProcedure
   .input(listCreditCardsSchema)
   .handler(async ({ context, input }) => {
      const { page, pageSize, search, status } = input;
      const offset = (page - 1) * pageSize;
      const where = and(
         eq(creditCards.teamId, context.teamId),
         status ? eq(creditCards.status, status) : undefined,
         search ? ilike(creditCards.name, `%${search}%`) : undefined,
      );

      const result = await fromPromise(
         Promise.all([
            context.db.query.creditCards.findMany({
               where: () => where,
               orderBy: (f, { asc }) => [asc(f.name)],
               limit: pageSize,
               offset,
            }),
            context.db
               .select({ count: sql<number>`cast(count(*) as int)` })
               .from(creditCards)
               .where(where),
         ]),
         () => WebAppError.internal("Falha ao listar cartões de crédito."),
      );
      if (result.isErr()) throw result.error;
      const [data, countResult] = result.value;
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
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(creditCards)
               .set({ ...data, updatedAt: dayjs().toDate() })
               .where(eq(creditCards.id, id))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao atualizar cartão de crédito."),
      );
      if (result.isErr()) throw result.error;
      const [updated] = result.value;
      if (!updated)
         throw WebAppError.notFound("Cartão de crédito não encontrado.");
      return updated;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireCreditCard, (input) => input.id)
   .handler(async ({ context, input }) => {
      const open = await fromPromise(
         context.db.query.creditCardStatements.findFirst({
            where: (f, { and, eq }) =>
               and(eq(f.creditCardId, input.id), eq(f.status, "open")),
         }),
         () => WebAppError.internal("Falha ao verificar faturas do cartão."),
      ).andThen((statement) =>
         statement
            ? err(
                 WebAppError.conflict(
                    "Cartão com faturas abertas não pode ser excluído.",
                 ),
              )
            : ok(undefined),
      );
      if (open.isErr()) throw open.error;

      const deleted = await fromPromise(
         context.db.transaction(async (tx) =>
            tx.delete(creditCards).where(eq(creditCards.id, input.id)),
         ),
         () => WebAppError.internal("Falha ao excluir cartão de crédito."),
      );
      if (deleted.isErr()) throw deleted.error;
      return { success: true };
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const cardsResult = await fromPromise(
         context.db.query.creditCards.findMany({
            where: (f, { and }) =>
               and(inArray(f.id, input.ids), eq(f.teamId, context.teamId)),
         }),
         () => WebAppError.internal("Falha ao buscar cartões."),
      );
      if (cardsResult.isErr()) throw cardsResult.error;
      if (cardsResult.value.length !== input.ids.length) {
         throw WebAppError.notFound("Um ou mais cartões não encontrados.");
      }

      const open = await fromPromise(
         context.db
            .select({
               creditCardId: creditCardStatements.creditCardId,
               name: creditCards.name,
            })
            .from(creditCardStatements)
            .innerJoin(
               creditCards,
               eq(creditCardStatements.creditCardId, creditCards.id),
            )
            .where(
               and(
                  inArray(creditCardStatements.creditCardId, input.ids),
                  eq(creditCardStatements.status, "open"),
               ),
            ),
         () => WebAppError.internal("Falha ao verificar faturas."),
      );
      if (open.isErr()) throw open.error;
      const blocking = open.value[0];
      if (blocking) {
         throw WebAppError.conflict(
            `Cartão "${blocking.name}" possui faturas abertas e não pode ser excluído.`,
         );
      }

      const deleted = await fromPromise(
         context.db.transaction(async (tx) =>
            tx.delete(creditCards).where(inArray(creditCards.id, input.ids)),
         ),
         () => WebAppError.internal("Falha ao excluir cartões."),
      );
      if (deleted.isErr()) throw deleted.error;
      return { deleted: input.ids.length };
   });

const bulkCreateSchema = z.object({
   cards: z
      .array(
         z.object({
            name: z.string().min(2).max(80),
            creditLimit: z.string(),
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

export const bulkCreate = protectedProcedure
   .input(bulkCreateSchema)
   .handler(async ({ context, input }) => {
      const uniqueAccountIds = [
         ...new Set(input.cards.map((c) => c.bankAccountId)),
      ];
      const validAccountsResult = await fromPromise(
         context.db
            .select({ id: bankAccounts.id })
            .from(bankAccounts)
            .where(
               and(
                  eq(bankAccounts.teamId, context.teamId),
                  inArray(bankAccounts.id, uniqueAccountIds),
               ),
            ),
         () => WebAppError.internal("Falha ao validar contas bancárias."),
      );
      if (validAccountsResult.isErr()) throw validAccountsResult.error;
      const validIds = new Set(validAccountsResult.value.map((a) => a.id));
      if (input.cards.some((c) => !validIds.has(c.bankAccountId))) {
         throw WebAppError.badRequest(
            "Conta bancária inválida para este time.",
         );
      }

      const rows = input.cards.map((c) => ({
         teamId: context.teamId,
         name: c.name,
         creditLimit: c.creditLimit,
         closingDay: c.closingDay,
         dueDay: c.dueDay,
         color: c.color ?? "#6366f1",
         status: c.status ?? "active",
         brand: c.brand,
         bankAccountId: c.bankAccountId,
      }));

      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(creditCards)
               .values(rows)
               .returning({ id: creditCards.id }),
         ),
         () => WebAppError.internal("Falha ao importar cartões."),
      );
      if (result.isErr()) throw result.error;
      return { created: result.value.length };
   });
