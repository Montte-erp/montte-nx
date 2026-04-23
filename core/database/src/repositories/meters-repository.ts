import { AppError, validateInput } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateMeterInput,
   type UpdateMeterInput,
   createMeterSchema,
   updateMeterSchema,
   meters,
} from "@core/database/schemas/meters";

const safeValidateCreate = fromThrowable(
   (data: CreateMeterInput) => validateInput(createMeterSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateMeterInput) => validateInput(updateMeterSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

export function createMeter(
   db: DatabaseInstance,
   teamId: string,
   data: CreateMeterInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(meters)
               .values({ ...validated, teamId })
               .returning();
            if (!row) throw AppError.database("Falha ao criar medidor.");
            return row;
         }),
         (e) => AppError.database("Falha ao criar medidor.", { cause: e }),
      ),
   );
}

export function getMeter(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.meters.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar medidor.", { cause: e }),
   ).map((meter) => meter ?? null);
}

export function listMeters(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db.query.meters.findMany({
         where: (fields, { eq }) => eq(fields.teamId, teamId),
         orderBy: (fields, { asc }) => [asc(fields.name)],
      }),
      (e) => AppError.database("Falha ao listar medidores.", { cause: e }),
   );
}

export function updateMeter(
   db: DatabaseInstance,
   id: string,
   data: UpdateMeterInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(meters)
               .set(validated)
               .where(eq(meters.id, id))
               .returning();
            if (!row) throw AppError.notFound("Medidor não encontrado.");
            return row;
         }),
         (e) => AppError.database("Falha ao atualizar medidor.", { cause: e }),
      ),
   );
}

export function deleteMeter(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.transaction(async (tx) => {
         await tx.delete(meters).where(eq(meters.id, id));
      }),
      (e) => AppError.database("Falha ao excluir medidor.", { cause: e }),
   ).map(() => undefined);
}

export function ensureMeterOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getMeter(db, id).andThen((meter) => {
      if (!meter || meter.teamId !== teamId)
         return err(AppError.notFound("Medidor não encontrado."));
      return ok(meter);
   });
}
