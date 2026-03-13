import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, eq, ilike, or, type SQL } from "drizzle-orm";
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

export async function createService(
   db: DatabaseInstance,
   teamId: string,
   data: CreateServiceInput,
) {
   const validated = validateInput(createServiceSchema, data);
   try {
      const [service] = await db
         .insert(services)
         .values({ ...validated, teamId })
         .returning();
      if (!service) throw AppError.database("Failed to create service");
      return service;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create service");
   }
}

export async function listServices(
   db: DatabaseInstance,
   teamId: string,
   filters?: ListServicesFilters,
) {
   try {
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

      return await db
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
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list services");
   }
}

export async function getService(db: DatabaseInstance, id: string) {
   try {
      const service = await db.query.services.findFirst({
         where: { id },
      });
      return service ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get service");
   }
}

export async function updateService(
   db: DatabaseInstance,
   id: string,
   data: UpdateServiceInput,
) {
   const validated = validateInput(updateServiceSchema, data);
   try {
      const [updated] = await db
         .update(services)
         .set(validated)
         .where(eq(services.id, id))
         .returning();
      return updated ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update service");
   }
}

export async function deleteService(db: DatabaseInstance, id: string) {
   try {
      await db.delete(services).where(eq(services.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete service");
   }
}

export async function createVariant(
   db: DatabaseInstance,
   teamId: string,
   serviceId: string,
   data: CreateVariantInput,
) {
   const validated = validateInput(createVariantSchema, data);
   try {
      const [variant] = await db
         .insert(serviceVariants)
         .values({ ...validated, teamId, serviceId })
         .returning();
      if (!variant) throw AppError.database("Failed to create variant");
      return variant;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create variant");
   }
}

export async function listVariantsByService(
   db: DatabaseInstance,
   serviceId: string,
) {
   try {
      return await db
         .select()
         .from(serviceVariants)
         .where(eq(serviceVariants.serviceId, serviceId))
         .orderBy(serviceVariants.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list variants");
   }
}

export async function getVariant(db: DatabaseInstance, id: string) {
   try {
      const variant = await db.query.serviceVariants.findFirst({
         where: { id },
      });
      return variant ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get variant");
   }
}

export async function updateVariant(
   db: DatabaseInstance,
   id: string,
   data: UpdateVariantInput,
) {
   const validated = validateInput(updateVariantSchema, data);
   try {
      const [updated] = await db
         .update(serviceVariants)
         .set(validated)
         .where(eq(serviceVariants.id, id))
         .returning();
      return updated ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update variant");
   }
}

export async function deleteVariant(db: DatabaseInstance, id: string) {
   try {
      await db.delete(serviceVariants).where(eq(serviceVariants.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete variant");
   }
}

export async function ensureServiceOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const service = await getService(db, id);
   if (!service || service.teamId !== teamId) {
      throw AppError.notFound("Serviço não encontrado.");
   }
   return service;
}

export async function ensureVariantOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const variant = await getVariant(db, id);
   if (!variant || variant.teamId !== teamId) {
      throw AppError.notFound("Variação não encontrada.");
   }
   return variant;
}
