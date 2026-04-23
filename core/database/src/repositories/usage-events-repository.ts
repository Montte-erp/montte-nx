import { AppError, validateInput } from "@core/logging/errors";
import { and, eq, gte, lte, sum } from "drizzle-orm";
import { fromPromise, fromThrowable } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   upsertUsageEventSchema,
   type UpsertUsageEventInput,
   usageEvents,
} from "@core/database/schemas/usage-events";

const safeValidateUpsert = fromThrowable(
   (data: UpsertUsageEventInput) => validateInput(upsertUsageEventSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

export function upsertUsageEvent(
   db: DatabaseInstance,
   data: UpsertUsageEventInput,
) {
   return safeValidateUpsert(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(usageEvents)
               .values(validated)
               .onConflictDoNothing({
                  target: [usageEvents.teamId, usageEvents.idempotencyKey],
               })
               .returning();
            return row ?? null;
         }),
         (e) =>
            AppError.database("Falha ao registrar evento de uso.", {
               cause: e,
            }),
      ),
   );
}

export function listUsageEventsByContact(
   db: DatabaseInstance,
   teamId: string,
   contactId: string,
) {
   return fromPromise(
      db.query.usageEvents.findMany({
         where: (fields, { eq, and }) =>
            and(eq(fields.teamId, teamId), eq(fields.contactId, contactId)),
      }),
      (e) => AppError.database("Falha ao listar eventos de uso.", { cause: e }),
   );
}

export type UsageSummaryByMeter = {
   meterId: string;
   total: string;
};

export function summarizeUsageByMeter(
   db: DatabaseInstance,
   teamId: string,
   period: { from: Date; to: Date },
): ReturnType<typeof fromPromise<UsageSummaryByMeter[], AppError>> {
   return fromPromise(
      db
         .select({
            meterId: usageEvents.meterId,
            total: sum(usageEvents.quantity),
         })
         .from(usageEvents)
         .where(
            and(
               eq(usageEvents.teamId, teamId),
               gte(usageEvents.timestamp, period.from),
               lte(usageEvents.timestamp, period.to),
            ),
         )
         .groupBy(usageEvents.meterId)
         .then((rows) =>
            rows.map((r) => ({
               meterId: r.meterId,
               total: r.total ?? "0",
            })),
         ),
      (e) =>
         AppError.database("Falha ao calcular uso por medidor.", { cause: e }),
   );
}
