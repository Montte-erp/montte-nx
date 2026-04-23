import { AppError, validateInput } from "@core/logging/errors";
import { and, eq, ilike, or, type SQL } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateServiceInput,
   type CreateVariantInput,
   type UpdateServiceInput,
   type UpdateVariantInput,
   createServiceSchema,
   createVariantSchema,
   services,
   serviceVariants,
   updateServiceSchema,
   updateVariantSchema,
} from "@core/database/schemas/services";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";

export interface ListServicesFilters {
   search?: string;
   categoryId?: string;
}

const safeValidateCreate = fromThrowable(
   (data: CreateServiceInput) => validateInput(createServiceSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateServiceInput) => validateInput(updateServiceSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateCreateVariant = fromThrowable(
   (data: CreateVariantInput) => validateInput(createVariantSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdateVariant = fromThrowable(
   (data: UpdateVariantInput) => validateInput(updateVariantSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

export function createService(
   db: DatabaseInstance,
   teamId: string,
   data: CreateServiceInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .insert(services)
            .values({ ...validated, teamId })
            .returning(),
         (e) => AppError.database("Falha ao criar serviço.", { cause: e }),
      ).andThen(([service]) =>
         service
            ? ok(service)
            : err(AppError.database("Falha ao criar serviço.")),
      ),
   );
}

export function listServices(
   db: DatabaseInstance,
   teamId: string,
   filters?: ListServicesFilters,
) {
   return fromPromise(
      (async () => {
         const conditions: SQL[] = [eq(services.teamId, teamId)];

         if (filters?.search) {
            const pattern = `%${filters.search}%`;
            const searchCondition = or(
               ilike(services.name, pattern),
               ilike(services.description, pattern),
            );
            if (searchCondition) conditions.push(searchCondition);
         }

         if (filters?.categoryId) {
            conditions.push(eq(services.categoryId, filters.categoryId));
         }

         return db
            .select({
               id: services.id,
               teamId: services.teamId,
               name: services.name,
               description: services.description,
               basePrice: services.basePrice,
               categoryId: services.categoryId,
               tagId: services.tagId,
               isActive: services.isActive,
               createdAt: services.createdAt,
               updatedAt: services.updatedAt,
               categoryName: categories.name,
               categoryColor: categories.color,
               tagName: tags.name,
               tagColor: tags.color,
            })
            .from(services)
            .leftJoin(categories, eq(services.categoryId, categories.id))
            .leftJoin(tags, eq(services.tagId, tags.id))
            .where(and(...conditions))
            .orderBy(services.name);
      })(),
      (e) => AppError.database("Falha ao listar serviços.", { cause: e }),
   );
}

export function getService(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.services.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar serviço.", { cause: e }),
   ).map((service) => service ?? null);
}

export function updateService(
   db: DatabaseInstance,
   id: string,
   data: UpdateServiceInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(services)
            .set(validated)
            .where(eq(services.id, id))
            .returning(),
         (e) => AppError.database("Falha ao atualizar serviço.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Serviço não encontrado.")),
      ),
   );
}

export function deleteService(db: DatabaseInstance, id: string) {
   return fromPromise(db.delete(services).where(eq(services.id, id)), (e) =>
      AppError.database("Falha ao excluir serviço.", { cause: e }),
   ).map(() => undefined);
}

export function createVariant(
   db: DatabaseInstance,
   teamId: string,
   serviceId: string,
   data: CreateVariantInput,
) {
   return safeValidateCreateVariant(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .insert(serviceVariants)
            .values({ ...validated, teamId, serviceId })
            .returning(),
         (e) => AppError.database("Falha ao criar variante.", { cause: e }),
      ).andThen(([variant]) =>
         variant
            ? ok(variant)
            : err(AppError.database("Falha ao criar variante.")),
      ),
   );
}

export function listVariantsByService(db: DatabaseInstance, serviceId: string) {
   return fromPromise(
      db
         .select()
         .from(serviceVariants)
         .where(eq(serviceVariants.serviceId, serviceId))
         .orderBy(serviceVariants.name),
      (e) => AppError.database("Falha ao listar variantes.", { cause: e }),
   );
}

export function getVariant(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.serviceVariants.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar variante.", { cause: e }),
   ).map((variant) => variant ?? null);
}

export function updateVariant(
   db: DatabaseInstance,
   id: string,
   data: UpdateVariantInput,
) {
   return safeValidateUpdateVariant(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(serviceVariants)
            .set(validated)
            .where(eq(serviceVariants.id, id))
            .returning(),
         (e) => AppError.database("Falha ao atualizar variante.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Variante não encontrada.")),
      ),
   );
}

export function deleteVariant(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.delete(serviceVariants).where(eq(serviceVariants.id, id)),
      (e) => AppError.database("Falha ao excluir variante.", { cause: e }),
   ).map(() => undefined);
}

export function ensureServiceOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getService(db, id).andThen((service) => {
      if (!service || service.teamId !== teamId)
         return err(AppError.notFound("Serviço não encontrado."));
      return ok(service);
   });
}

export function ensureVariantOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getVariant(db, id).andThen((variant) => {
      if (!variant || variant.teamId !== teamId)
         return err(AppError.notFound("Variação não encontrada."));
      return ok(variant);
   });
}

export function bulkCreateServices(
   db: DatabaseInstance,
   teamId: string,
   items: CreateServiceInput[],
) {
   const safeValidateAll = fromThrowable(
      () => items.map((item) => validateInput(createServiceSchema, item)),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.validation("Dados inválidos.", { cause: e }),
   );
   return safeValidateAll().asyncAndThen((validated) =>
      fromPromise(
         db
            .insert(services)
            .values(validated.map((item) => ({ ...item, teamId })))
            .returning(),
         (e) => AppError.database("Falha ao importar serviços.", { cause: e }),
      ),
   );
}
