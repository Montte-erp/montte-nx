import { AppError, validateInput } from "@core/logging/errors";
import { and, eq, ilike, or, type SQL } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateServiceInput,
   type CreatePriceInput,
   type UpdateServiceInput,
   type UpdatePriceInput,
   createServiceSchema,
   createPriceSchema,
   services,
   servicePrices,
   updateServiceSchema,
   updatePriceSchema,
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

const safeValidateCreatePrice = fromThrowable(
   (data: CreatePriceInput) => validateInput(createPriceSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdatePrice = fromThrowable(
   (data: UpdatePriceInput) => validateInput(updatePriceSchema, data),
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

export function createPrice(
   db: DatabaseInstance,
   teamId: string,
   serviceId: string,
   data: CreatePriceInput,
) {
   return safeValidateCreatePrice(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .insert(servicePrices)
            .values({ ...validated, teamId, serviceId })
            .returning(),
         (e) => AppError.database("Falha ao criar preço.", { cause: e }),
      ).andThen(([price]) =>
         price ? ok(price) : err(AppError.database("Falha ao criar preço.")),
      ),
   );
}

export function listPricesByService(db: DatabaseInstance, serviceId: string) {
   return fromPromise(
      db
         .select()
         .from(servicePrices)
         .where(eq(servicePrices.serviceId, serviceId))
         .orderBy(servicePrices.name),
      (e) => AppError.database("Falha ao listar preços.", { cause: e }),
   );
}

export function getPrice(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.servicePrices.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar preço.", { cause: e }),
   ).map((price) => price ?? null);
}

export function updatePrice(
   db: DatabaseInstance,
   id: string,
   data: UpdatePriceInput,
) {
   return safeValidateUpdatePrice(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(servicePrices)
            .set(validated)
            .where(eq(servicePrices.id, id))
            .returning(),
         (e) => AppError.database("Falha ao atualizar preço.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Preço não encontrado.")),
      ),
   );
}

export function deletePrice(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.delete(servicePrices).where(eq(servicePrices.id, id)),
      (e) => AppError.database("Falha ao excluir preço.", { cause: e }),
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

export function ensurePriceOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getPrice(db, id).andThen((price) => {
      if (!price || price.teamId !== teamId)
         return err(AppError.notFound("Preço não encontrado."));
      return ok(price);
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
