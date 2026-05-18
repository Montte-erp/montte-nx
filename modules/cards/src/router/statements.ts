import dayjs from "dayjs";
import { Result } from "better-result";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
   createStatementSchema,
   creditCardStatements,
} from "@core/database/schemas/credit-card-statements";
import { creditCardStatementTotals } from "@core/database/schemas/credit-card-statement-totals";
import { creditCards } from "@core/database/schemas/credit-cards";
import { protectedProcedure } from "@core/orpc/server";
import {
   CardsRouterError,
   cardsRouterErrors,
   requireCreditCard,
} from "@modules/cards/router/middlewares";
import { findCreditCardStatement } from "@modules/cards/router/utils";

const idSchema = z.object({ id: z.string().uuid() });

const listStatementsSchema = z.object({
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(1000).catch(20).default(20),
   creditCardId: z.string().uuid().optional(),
   statementPeriod: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida.")
      .optional(),
   status: z.enum(["open", "paid"]).optional(),
});

const statusInputSchema = idSchema.extend({
   paymentTransactionId: z.string().uuid().nullable().optional(),
});

async function requireStatement(
   db: Parameters<typeof findCreditCardStatement>[0],
   id: string,
   teamId: string,
) {
   const statement = await findCreditCardStatement(db, id, teamId);
   if (Result.isError(statement)) return Result.err(statement.error);
   if (!statement.value) {
      return Result.err(
         new CardsRouterError({
            error: cardsRouterErrors.NOT_FOUND(),
            message: "Fatura não encontrada.",
         }),
      );
   }
   return Result.ok(statement.value);
}

async function validatePaymentTransaction(
   db: Parameters<typeof findCreditCardStatement>[0],
   paymentTransactionId: string | null,
   statement: {
      creditCardId: string;
   },
   teamId: string,
) {
   if (!paymentTransactionId) return Result.ok();

   const transaction = await Result.tryPromise({
      try: () =>
         db.query.transactions.findFirst({
            where: (f, { eq }) => eq(f.id, paymentTransactionId),
         }),
      catch: () =>
         new CardsRouterError({
            error: cardsRouterErrors.INTERNAL(),
            message: "Falha ao verificar transação de pagamento.",
         }),
   });
   if (Result.isError(transaction)) return Result.err(transaction.error);
   if (!transaction.value || transaction.value.teamId !== teamId) {
      return Result.err(
         new CardsRouterError({
            error: cardsRouterErrors.NOT_FOUND(),
            message: "Transação de pagamento não encontrada.",
         }),
      );
   }
   if (
      transaction.value.type !== "expense" ||
      transaction.value.status !== "paid" ||
      transaction.value.ignored
   ) {
      return Result.err(
         new CardsRouterError({
            error: cardsRouterErrors.BAD_REQUEST(),
            message: "Transação de pagamento inválida para esta fatura.",
         }),
      );
   }
   if (
      transaction.value.creditCardId &&
      transaction.value.creditCardId !== statement.creditCardId
   ) {
      return Result.err(
         new CardsRouterError({
            error: cardsRouterErrors.BAD_REQUEST(),
            message: "Transação de pagamento pertence a outro cartão.",
         }),
      );
   }

   return Result.ok();
}

export const create = protectedProcedure
   .input(createStatementSchema)
   .use(requireCreditCard, (input) => input.creditCardId)
   .handler(async ({ context, input }) => {
      const existing = await Result.tryPromise({
         try: () =>
            context.db.query.creditCardStatements.findFirst({
               where: (f, { and, eq }) =>
                  and(
                     eq(f.creditCardId, input.creditCardId),
                     eq(f.statementPeriod, input.statementPeriod),
                  ),
            }),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao verificar fatura.",
            }),
      });
      if (Result.isError(existing)) throw existing.error;
      if (existing.value) {
         throw new CardsRouterError({
            error: cardsRouterErrors.CONFLICT(),
            message: "Já existe fatura para esta competência.",
         });
      }

      const created = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx.insert(creditCardStatements).values(input).returning(),
            ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao criar fatura.",
            }),
      });
      if (Result.isError(created)) throw created.error;
      const [statement] = created.value;
      if (!statement) {
         throw new CardsRouterError({
            error: cardsRouterErrors.INTERNAL(),
            message: "Falha ao criar fatura.",
         });
      }
      return statement;
   });

export const getAll = protectedProcedure
   .input(listStatementsSchema)
   .handler(async ({ context, input }) => {
      const { creditCardId, page, pageSize, statementPeriod, status } = input;
      const offset = (page - 1) * pageSize;
      const where = and(
         eq(creditCards.teamId, context.teamId),
         creditCardId
            ? eq(creditCardStatements.creditCardId, creditCardId)
            : undefined,
         statementPeriod
            ? eq(creditCardStatements.statementPeriod, statementPeriod)
            : undefined,
         status ? eq(creditCardStatements.status, status) : undefined,
      );

      const listed = await Result.tryPromise({
         try: () =>
            Promise.all([
               context.db
                  .select({
                     statement: creditCardStatements,
                     totalPurchases: creditCardStatementTotals.totalPurchases,
                     transactionCount:
                        creditCardStatementTotals.transactionCount,
                  })
                  .from(creditCardStatements)
                  .innerJoin(
                     creditCards,
                     eq(creditCardStatements.creditCardId, creditCards.id),
                  )
                  .leftJoin(
                     creditCardStatementTotals,
                     and(
                        eq(
                           creditCardStatementTotals.creditCardId,
                           creditCardStatements.creditCardId,
                        ),
                        eq(
                           creditCardStatementTotals.statementPeriod,
                           creditCardStatements.statementPeriod,
                        ),
                     ),
                  )
                  .where(where)
                  .orderBy(
                     desc(creditCardStatements.statementPeriod),
                     desc(creditCardStatements.dueDate),
                  )
                  .limit(pageSize)
                  .offset(offset),
               context.db
                  .select({ count: sql<number>`cast(count(*) as int)` })
                  .from(creditCardStatements)
                  .innerJoin(
                     creditCards,
                     eq(creditCardStatements.creditCardId, creditCards.id),
                  )
                  .where(where),
            ]),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao listar faturas.",
            }),
      });
      if (Result.isError(listed)) throw listed.error;
      const [rows, countResult] = listed.value;
      const totalCount = countResult[0]?.count ?? 0;
      const data = rows.map((row) => ({
         ...row.statement,
         totalPurchases: row.totalPurchases ?? "0",
         transactionCount: row.transactionCount ?? 0,
      }));

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
   .handler(async ({ context, input }) => {
      const statement = await requireStatement(
         context.db,
         input.id,
         context.teamId,
      );
      if (Result.isError(statement)) throw statement.error;
      return statement.value;
   });

export const markAsPaid = protectedProcedure
   .input(statusInputSchema)
   .handler(async ({ context, input }) => {
      const statement = await requireStatement(
         context.db,
         input.id,
         context.teamId,
      );
      if (Result.isError(statement)) throw statement.error;
      const paymentTransactionId = input.paymentTransactionId ?? null;
      const paymentTransaction = await validatePaymentTransaction(
         context.db,
         paymentTransactionId,
         statement.value,
         context.teamId,
      );
      if (Result.isError(paymentTransaction)) throw paymentTransaction.error;

      const updated = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(creditCardStatements)
                  .set({
                     status: "paid",
                     paymentTransactionId,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(eq(creditCardStatements.id, input.id))
                  .returning(),
            ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao marcar fatura como paga.",
            }),
      });
      if (Result.isError(updated)) throw updated.error;
      const [row] = updated.value;
      if (!row) {
         throw new CardsRouterError({
            error: cardsRouterErrors.NOT_FOUND(),
            message: "Fatura não encontrada.",
         });
      }
      return row;
   });

export const markAsOpen = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const statement = await requireStatement(
         context.db,
         input.id,
         context.teamId,
      );
      if (Result.isError(statement)) throw statement.error;

      const updated = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(creditCardStatements)
                  .set({
                     status: "open",
                     paymentTransactionId: null,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(eq(creditCardStatements.id, input.id))
                  .returning(),
            ),
         catch: () =>
            new CardsRouterError({
               error: cardsRouterErrors.INTERNAL(),
               message: "Falha ao reabrir fatura.",
            }),
      });
      if (Result.isError(updated)) throw updated.error;
      const [row] = updated.value;
      if (!row) {
         throw new CardsRouterError({
            error: cardsRouterErrors.NOT_FOUND(),
            message: "Fatura não encontrada.",
         });
      }
      return row;
   });
