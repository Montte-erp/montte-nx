import { AppError, validateInput } from "@core/logging/errors";
import { and, eq } from "drizzle-orm";
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
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateBenefitInput) => validateInput(updateBenefitSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
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
         (e) =>
            e instanceof AppError
               ? e
               : AppError.database("Falha ao criar benefício.", { cause: e }),
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
      db
         .select()
         .from(benefits)
         .where(eq(benefits.teamId, teamId))
         .orderBy(benefits.name),
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
         db
            .update(benefits)
            .set(validated)
            .where(eq(benefits.id, id))
            .returning(),
         (e) =>
            AppError.database("Falha ao atualizar benefício.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Benefício não encontrado.")),
      ),
   );
}

export function deleteBenefit(db: DatabaseInstance, id: string) {
   return fromPromise(db.delete(benefits).where(eq(benefits.id, id)), (e) =>
      AppError.database("Falha ao excluir benefício.", { cause: e }),
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
      db
         .insert(serviceBenefits)
         .values({ serviceId, benefitId })
         .onConflictDoNothing()
         .returning(),
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
      db
         .delete(serviceBenefits)
         .where(
            and(
               eq(serviceBenefits.serviceId, serviceId),
               eq(serviceBenefits.benefitId, benefitId),
            ),
         ),
      (e) =>
         AppError.database("Falha ao remover benefício do serviço.", {
            cause: e,
         }),
   ).map(() => undefined);
}

export function listBenefitsByService(db: DatabaseInstance, serviceId: string) {
   return fromPromise(
      db
         .select({ benefit: benefits })
         .from(serviceBenefits)
         .innerJoin(benefits, eq(serviceBenefits.benefitId, benefits.id))
         .where(eq(serviceBenefits.serviceId, serviceId)),
      (e) =>
         AppError.database("Falha ao listar benefícios do serviço.", {
            cause: e,
         }),
   ).map((rows) => rows.map((r) => r.benefit));
}
