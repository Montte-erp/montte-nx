import { AppError, validateInput } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   usageEvents,
   upsertUsageEventSchema,
   type UpsertUsageEventInput,
} from "@core/database/schemas/usage-events";

const safeValidateUpsert = fromThrowable(
   (data: UpsertUsageEventInput) => validateInput(upsertUsageEventSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

export function upsertUsageEvent(
   db: DatabaseInstance,
   data: UpsertUsageEventInput,
) {
   return safeValidateUpsert(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .insert(usageEvents)
            .values(validated)
            .onConflictDoNothing({
               target: [usageEvents.teamId, usageEvents.idempotencyKey],
            })
            .returning(),
         (e) =>
            AppError.database("Falha ao registrar evento de uso.", {
               cause: e,
            }),
      ).map(([row]) => row ?? null),
   );
}

export function listUsageEventsByTeam(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db.select().from(usageEvents).where(eq(usageEvents.teamId, teamId)),
      (e) => AppError.database("Falha ao listar eventos de uso.", { cause: e }),
   );
}
