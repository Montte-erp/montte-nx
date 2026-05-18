import { defineErrorCatalog } from "evlog";
import { Result, TaggedError } from "better-result";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { creditCards } from "@core/database/schemas/credit-cards";
import { computeStatementPeriod } from "@core/database/helpers/credit-card-dates";
import { isIsoDateString } from "@core/utils/dates";
import { log } from "@core/logging";
import { defaultPgBossWorkOptions } from "@core/pg-boss/worker";
import type { PgBossClient } from "@core/pg-boss/client";
import type { DatabaseInstance } from "@core/database/client";
import type { SendOptions } from "pg-boss";
import { closeStatement, type CloseStatementInput } from "../statements";

const CLOSE_STATEMENTS_QUEUE = "cards/close-statements";
const CLOSE_STATEMENTS_DEAD_LETTER_QUEUE = "cards/close-statements/dead-letter";

export const closeStatementsQueue = {
   name: CLOSE_STATEMENTS_QUEUE,
   policy: "key_strict_fifo",
   retryLimit: 5,
   retryDelay: 10,
   retryBackoff: true,
   retryDelayMax: 300,
   expireInSeconds: 600,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 604_800,
   heartbeatSeconds: 30,
   warningQueueSize: 25,
   deadLetter: CLOSE_STATEMENTS_DEAD_LETTER_QUEUE,
};

export const closeStatementsDeadLetterQueue = {
   name: CLOSE_STATEMENTS_DEAD_LETTER_QUEUE,
   retryLimit: 0,
   expireInSeconds: 60,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 2_592_000,
   warningQueueSize: 1,
};

export const cardsPgBossQueues = [
   closeStatementsDeadLetterQueue,
   closeStatementsQueue,
];

export const closeStatementsJobInputSchema = z.object({
   today: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => isIsoDateString(value), {
         message: "Data inválida.",
      })
      .default(() => dayjs().format("YYYY-MM-DD")),
});

const closeStatementsJobErrors = defineErrorCatalog(
   "cards.job.close-statements",
   {
      INVALID_PAYLOAD: {
         status: 400,
         message: "Payload inválido para fechamento de faturas.",
         tags: ["cards", "job", "close"],
      },
      QUERY_FAILED: {
         status: 500,
         message: "Falha ao localizar faturas para fechamento.",
         tags: ["cards", "job", "close", "query"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cards.job.close-statements": typeof closeStatementsJobErrors;
   }
}

type CloseStatementsJobCatalogError =
   | ReturnType<typeof closeStatementsJobErrors.INVALID_PAYLOAD>
   | ReturnType<typeof closeStatementsJobErrors.QUERY_FAILED>;

export class CloseStatementsJobError extends TaggedError(
   "CloseStatementsJobError",
)<{
   error: CloseStatementsJobCatalogError;
   message: string;
   teamId?: string;
   creditCardId?: string;
   statementPeriod?: string;
   jobId?: string;
   jobPayload?: unknown;
}>() {}

export type CloseStatementsJobInput = z.infer<
   typeof closeStatementsJobInputSchema
>;

type HandleCloseStatementsJobInput = {
   db: DatabaseInstance;
   job: { id: string; data: unknown };
};

export function enqueueCloseStatementsJob(options: {
   boss: PgBossClient;
   today?: string;
}) {
   const rawPayload = options.today ? { today: options.today } : {};
   const parsedPayload = closeStatementsJobInputSchema.safeParse(rawPayload);
   if (!parsedPayload.success) {
      return Result.err(
         new CloseStatementsJobError({
            error: closeStatementsJobErrors.INVALID_PAYLOAD(),
            message: "Payload inválido para fechamento de faturas.",
            jobPayload: rawPayload,
         }),
      );
   }

   const payload = parsedPayload.data;
   const sendOptions: SendOptions = {
      retryLimit: closeStatementsQueue.retryLimit,
      retryDelay: closeStatementsQueue.retryDelay,
      retryBackoff: closeStatementsQueue.retryBackoff,
      retryDelayMax: closeStatementsQueue.retryDelayMax,
      expireInSeconds: closeStatementsQueue.expireInSeconds,
      retentionSeconds: closeStatementsQueue.retentionSeconds,
      deleteAfterSeconds: closeStatementsQueue.deleteAfterSeconds,
      heartbeatSeconds: closeStatementsQueue.heartbeatSeconds,
      deadLetter: closeStatementsQueue.deadLetter,
   };

   return Result.tryPromise({
      try: () =>
         options.boss.send(CLOSE_STATEMENTS_QUEUE, payload, sendOptions),
      catch: () =>
         new CloseStatementsJobError({
            error: closeStatementsJobErrors.QUERY_FAILED(),
            message: "Falha ao enfileirar fechamento de faturas.",
            jobPayload: payload,
         }),
   });
}

export async function handleCloseStatementsJob({
   db,
   job,
}: HandleCloseStatementsJobInput) {
   const parsed = closeStatementsJobInputSchema.safeParse(job.data);
   if (!parsed.success) {
      return Result.err(
         new CloseStatementsJobError({
            error: closeStatementsJobErrors.INVALID_PAYLOAD(),
            message: "Payload inválido para fechamento de faturas.",
            jobId: job.id,
            jobPayload: job.data,
         }),
      );
   }

   const payload = parsed.data;
   const today = dayjs(payload.today, "YYYY-MM-DD", true);
   const todayString = today.format("YYYY-MM-DD");
   const statements = await Result.tryPromise({
      try: () =>
         db
            .select({
               creditCardId: creditCardStatements.creditCardId,
               statementPeriod: creditCardStatements.statementPeriod,
               closingDate: creditCardStatements.closingDate,
               closingDay: creditCards.closingDay,
               teamId: creditCards.teamId,
            })
            .from(creditCardStatements)
            .innerJoin(
               creditCards,
               eq(creditCardStatements.creditCardId, creditCards.id),
            )
            .where(eq(creditCardStatements.status, "open")),
      catch: () =>
         new CloseStatementsJobError({
            error: closeStatementsJobErrors.QUERY_FAILED(),
            message: "Falha ao localizar faturas para fechamento.",
            jobId: job.id,
         }),
   });

   if (Result.isError(statements)) return Result.err(statements.error);

   const closable = statements.value.filter((statement) => {
      const closingDate = dayjs(statement.closingDate);
      const byClosingDate =
         closingDate.isSame(today, "day") || closingDate.isBefore(today, "day");
      const currentPeriod = computeStatementPeriod(
         todayString,
         statement.closingDay,
      );
      const byCompetence = statement.statementPeriod < currentPeriod;
      return byClosingDate || byCompetence;
   });

   if (closable.length === 0) {
      log.info({
         module: "cards.close-statements-job",
         message: "Nenhuma fatura elegível para fechamento encontrada.",
         jobId: job.id,
         executedAt: todayString,
      });
      return Result.ok(0);
   }

   log.info({
      module: "cards.close-statements-job",
      message: "Fechando faturas em lote.",
      jobId: job.id,
      totalCandidates: closable.length,
   });

   const errors: Error[] = [];
   const closeResults = await Promise.allSettled(
      closable.map((statement) => {
         const input: CloseStatementInput = {
            db,
            creditCardId: statement.creditCardId,
            statementPeriod: statement.statementPeriod,
            teamId: statement.teamId,
            status: "paid",
         };
         return closeStatement(input);
      }),
   );

   closeResults.forEach((result, index) => {
      const statement = closable[index];
      if (!statement) return;

      if (result.status === "rejected") {
         const reason = result.reason;
         const reasonError =
            reason instanceof Error
               ? reason
               : new Error("Falha ao fechar fatura automática.", {
                    cause: reason,
                 });
         errors.push(reasonError);
         log.error({
            module: "cards.close-statements-job",
            message: "Falha ao fechar fatura automática",
            jobId: job.id,
            creditCardId: statement.creditCardId,
            statementPeriod: statement.statementPeriod,
            teamId: statement.teamId,
            err: reasonError,
         });
         return;
      }

      if (Result.isError(result.value)) {
         const closeError = result.value.error;
         errors.push(closeError);
         log.error({
            module: "cards.close-statements-job",
            message: "Falha ao fechar fatura automática",
            jobId: job.id,
            creditCardId: statement.creditCardId,
            statementPeriod: statement.statementPeriod,
            teamId: statement.teamId,
            err: closeError,
         });
      }
   });

   if (errors.length > 0) {
      return Result.err(new AggregateError(errors));
   }

   log.info({
      module: "cards.close-statements-job",
      message: "Fechamento de faturas concluído.",
      jobId: job.id,
      closedCount: closable.length,
      executedAt: todayString,
   });

   return Result.ok(closable.length);
}

export async function registerCardsPgBossJobs(options: {
   boss: PgBossClient;
   db: DatabaseInstance;
}) {
   await options.boss.work(
      closeStatementsQueue.name,
      defaultPgBossWorkOptions,
      async (jobs) => {
         const errors: Error[] = [];
         const handled = await Promise.allSettled(
            jobs.map((job) =>
               handleCloseStatementsJob({
                  db: options.db,
                  job: {
                     id: job.id,
                     data: job.data,
                  },
               }),
            ),
         );

         for (const result of handled) {
            if (result.status === "rejected") {
               const reason = result.reason;
               errors.push(
                  reason instanceof Error
                     ? reason
                     : new Error("Falha ao processar job de fechamento.", {
                          cause: reason,
                       }),
               );
               continue;
            }

            if (result.value.isErr()) {
               errors.push(result.value.error);
            }
         }

         if (errors.length > 0) {
            throw new AggregateError(errors);
         }
      },
   );
}
