import { AppError, propagateError } from "@core/utils/errors";
import {
   and,
   count,
   eq,
   gte,
   ilike,
   inArray,
   lte,
   or,
   type SQL,
} from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   categories,
   contactSubscriptions,
   type NewContactSubscription,
   type NewService,
   type NewServiceVariant,
   type SubscriptionStatus,
   services,
   serviceVariants,
   tags,
} from "../schema";

// ---------------------------------------------------------------------------
// Services CRUD
// ---------------------------------------------------------------------------

export interface ListServicesFilters {
   search?: string;
   type?: "service" | "product" | "subscription";
   categoryId?: string;
   contactId?: string;
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

      if (filters?.type) {
         conditions.push(eq(services.type, filters.type));
      }

      if (filters?.categoryId) {
         conditions.push(eq(services.categoryId, filters.categoryId));
      }

      if (filters?.contactId) {
         // Find services used by this contact via service_variants → contact_subscriptions
         const variantServiceIds = db
            .selectDistinct({ serviceId: serviceVariants.serviceId })
            .from(serviceVariants)
            .innerJoin(
               contactSubscriptions,
               eq(serviceVariants.id, contactSubscriptions.variantId),
            )
            .where(eq(contactSubscriptions.contactId, filters.contactId));
         conditions.push(inArray(services.id, variantServiceIds));
      }

      return await db
         .select({
            id: services.id,
            teamId: services.teamId,
            name: services.name,
            description: services.description,
            basePrice: services.basePrice,
            type: services.type,
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
      const [service] = await db
         .select()
         .from(services)
         .where(eq(services.id, id));
      return service ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get service");
   }
}

export async function createService(db: DatabaseInstance, data: NewService) {
   try {
      const [service] = await db.insert(services).values(data).returning();
      return service;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create service");
   }
}

export async function updateService(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewService>,
) {
   try {
      const [updated] = await db
         .update(services)
         .set(data)
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

export async function bulkCreateServices(
   db: DatabaseInstance,
   data: NewService[],
): Promise<{ created: number; errors: { row: number; message: string }[] }> {
   const errors: { row: number; message: string }[] = [];
   let created = 0;

   try {
      await db.transaction(async (tx) => {
         for (let i = 0; i < data.length; i++) {
            try {
               // biome-ignore lint/style/noNonNullAssertion: index is within bounds
               await tx.insert(services).values(data[i]!);
               created++;
            } catch (err) {
               errors.push({
                  row: i,
                  message: err instanceof Error ? err.message : "Unknown error",
               });
            }
         }
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to bulk create services");
   }

   return { created, errors };
}

// ---------------------------------------------------------------------------
// Service Variants CRUD
// ---------------------------------------------------------------------------

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
      const [variant] = await db
         .select()
         .from(serviceVariants)
         .where(eq(serviceVariants.id, id));
      return variant ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get variant");
   }
}

export async function createVariant(
   db: DatabaseInstance,
   data: NewServiceVariant,
) {
   try {
      const [variant] = await db
         .insert(serviceVariants)
         .values(data)
         .returning();
      return variant;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create variant");
   }
}

export async function updateVariant(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewServiceVariant>,
) {
   try {
      const [updated] = await db
         .update(serviceVariants)
         .set(data)
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

// ---------------------------------------------------------------------------
// Contact Subscriptions
// ---------------------------------------------------------------------------

export async function listSubscriptionsByTeam(
   db: DatabaseInstance,
   teamId: string,
   status?: SubscriptionStatus,
) {
   try {
      const conditions = [eq(contactSubscriptions.teamId, teamId)];
      if (status) conditions.push(eq(contactSubscriptions.status, status));
      return await db
         .select()
         .from(contactSubscriptions)
         .where(and(...conditions))
         .orderBy(contactSubscriptions.startDate);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list subscriptions");
   }
}

export async function listSubscriptionsByContact(
   db: DatabaseInstance,
   contactId: string,
) {
   try {
      return await db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.contactId, contactId))
         .orderBy(contactSubscriptions.startDate);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list contact subscriptions");
   }
}

export async function getSubscription(db: DatabaseInstance, id: string) {
   try {
      const [sub] = await db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.id, id));
      return sub ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get subscription");
   }
}

export async function createSubscription(
   db: DatabaseInstance,
   data: NewContactSubscription,
) {
   try {
      const [sub] = await db
         .insert(contactSubscriptions)
         .values(data)
         .returning();
      return sub;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create subscription");
   }
}

export async function updateSubscription(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewContactSubscription>,
) {
   try {
      const [updated] = await db
         .update(contactSubscriptions)
         .set(data)
         .where(eq(contactSubscriptions.id, id))
         .returning();
      return updated ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update subscription");
   }
}

export async function upsertSubscriptionByExternalId(
   db: DatabaseInstance,
   externalId: string,
   data: NewContactSubscription,
) {
   try {
      // externalId has no unique constraint, so we cannot use onConflictDoUpdate.
      // Use a manual select-then-insert-or-update pattern instead.
      // NOTE: Known TOCTOU race condition — two concurrent Asaas webhook events for the
      // same externalId could both pass the exists check and both insert. Acceptable for
      // this use case: Asaas webhooks are single-threaded per subscription, so concurrent
      // duplicates are extremely unlikely. A unique constraint on externalId would fix
      // this properly but requires a schema migration.
      const [existing] = await db
         .select({ id: contactSubscriptions.id })
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.externalId, externalId));

      if (existing) {
         const [updated] = await db
            .update(contactSubscriptions)
            .set({
               status: data.status,
               negotiatedPrice: data.negotiatedPrice,
               endDate: data.endDate,
               updatedAt: new Date(),
            })
            .where(eq(contactSubscriptions.id, existing.id))
            .returning();
         return updated;
      }

      const [inserted] = await db
         .insert(contactSubscriptions)
         .values(data)
         .returning();
      return inserted;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert subscription");
   }
}

// ---------------------------------------------------------------------------
// Analytics helpers
// ---------------------------------------------------------------------------

export async function countActiveSubscriptionsByVariant(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      return await db
         .select({
            variantId: contactSubscriptions.variantId,
            count: count(),
         })
         .from(contactSubscriptions)
         .where(
            and(
               eq(contactSubscriptions.teamId, teamId),
               eq(contactSubscriptions.status, "active" as SubscriptionStatus),
            ),
         )
         .groupBy(contactSubscriptions.variantId);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to count subscriptions");
   }
}

export async function listExpiringSoon(
   db: DatabaseInstance,
   teamId: string,
   withinDays = 30,
) {
   try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + withinDays);
      return await db
         .select()
         .from(contactSubscriptions)
         .where(
            and(
               eq(contactSubscriptions.teamId, teamId),
               eq(contactSubscriptions.status, "active" as SubscriptionStatus),
               lte(
                  contactSubscriptions.endDate,
                  cutoff.toISOString().slice(0, 10),
               ),
               gte(
                  contactSubscriptions.endDate,
                  new Date().toISOString().slice(0, 10),
               ),
            ),
         )
         .orderBy(contactSubscriptions.endDate);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list expiring subscriptions");
   }
}
