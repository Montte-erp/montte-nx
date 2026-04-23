import { AppError, validateInput } from "@core/logging/errors";
import { and, eq, inArray } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateBenefitInput,
   type UpdateBenefitInput,
   createBenefitSchema,
   updateBenefitSchema,
   benefits,
   serviceBenefits,
} from "@core/database/schemas/benefits";

const safeValidateCreate = fromThrowable(
   (data: CreateBenefitInput) => validateInput(createBenefitSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateBenefitInput) => validateInput(updateBenefitSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

export function createBenefit(
   db: DatabaseInstance,
   teamId: string,
   data: CreateBenefitInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(benefits)
               .values({ ...validated, teamId })
               .returning();
            if (!row) throw AppError.database("Falha ao criar benefício.");
            return row;
         }),
         (e) => AppError.database("Falha ao criar benefício.", { cause: e }),
      ),
   );
}

export function getBenefit(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.benefits.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar benefício.", { cause: e }),
   ).map((benefit) => benefit ?? null);
}

export function listBenefits(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db.query.benefits.findMany({
         where: (fields, { eq }) => eq(fields.teamId, teamId),
         orderBy: (fields, { asc }) => [asc(fields.name)],
      }),
      (e) => AppError.database("Falha ao listar benefícios.", { cause: e }),
   );
}

export function updateBenefit(
   db: DatabaseInstance,
   id: string,
   data: UpdateBenefitInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(benefits)
               .set(validated)
               .where(eq(benefits.id, id))
               .returning();
            if (!row) throw AppError.notFound("Benefício não encontrado.");
            return row;
         }),
         (e) =>
            AppError.database("Falha ao atualizar benefício.", { cause: e }),
      ),
   );
}

export function deleteBenefit(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.transaction(async (tx) => {
         await tx.delete(benefits).where(eq(benefits.id, id));
      }),
      (e) => AppError.database("Falha ao excluir benefício.", { cause: e }),
   ).map(() => undefined);
}

export function ensureBenefitOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getBenefit(db, id).andThen((benefit) => {
      if (!benefit || benefit.teamId !== teamId)
         return err(AppError.notFound("Benefício não encontrado."));
      return ok(benefit);
   });
}

export function attachBenefitToService(
   db: DatabaseInstance,
   serviceId: string,
   benefitId: string,
) {
   return fromPromise(
      db.transaction(async (tx) => {
         await tx
            .insert(serviceBenefits)
            .values({ serviceId, benefitId })
            .onConflictDoNothing();
      }),
      (e) =>
         AppError.database("Falha ao associar benefício ao serviço.", {
            cause: e,
         }),
   ).map(() => undefined);
}

export function detachBenefitFromService(
   db: DatabaseInstance,
   serviceId: string,
   benefitId: string,
) {
   return fromPromise(
      db.transaction(async (tx) => {
         await tx
            .delete(serviceBenefits)
            .where(
               and(
                  eq(serviceBenefits.serviceId, serviceId),
                  eq(serviceBenefits.benefitId, benefitId),
               ),
            );
      }),
      (e) =>
         AppError.database("Falha ao remover benefício do serviço.", {
            cause: e,
         }),
   ).map(() => undefined);
}

export function listBenefitsByIds(db: DatabaseInstance, benefitIds: string[]) {
   if (benefitIds.length === 0)
      return fromPromise(Promise.resolve([]), (e) =>
         AppError.database("", { cause: e }),
      );
   return fromPromise(
      db.query.benefits.findMany({
         where: (fields, { inArray: inArrayFn }) =>
            inArrayFn(fields.id, benefitIds),
      }),
      (e) => AppError.database("Falha ao listar benefícios.", { cause: e }),
   );
}

export function listBenefitsByService(db: DatabaseInstance, serviceId: string) {
   return fromPromise(
      db.query.serviceBenefits.findMany({
         where: (fields, { eq }) => eq(fields.serviceId, serviceId),
         with: { benefit: true },
      }),
      (e) =>
         AppError.database("Falha ao listar benefícios do serviço.", {
            cause: e,
         }),
   ).map((rows) => rows.map((r) => r.benefit));
}
