import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateSubscriptionInput,
   type UpdateSubscriptionInput,
   contactSubscriptions,
   createSubscriptionSchema,
   updateSubscriptionSchema,
} from "@core/database/schemas/subscriptions";

export async function createSubscription(
   teamId: string,
   data: CreateSubscriptionInput,
) {
   const validated = validateInput(createSubscriptionSchema, data);
   try {
      const [subscription] = await db
         .insert(contactSubscriptions)
         .values({ ...validated, teamId })
         .returning();
      if (!subscription)
         throw AppError.database("Failed to create subscription");
      return subscription;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create subscription");
   }
}

export async function getSubscription(id: string) {
   try {
      const subscription = await db.query.contactSubscriptions.findFirst({
         where: { id },
      });
      return subscription ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get subscription");
   }
}

export async function updateSubscription(
   id: string,
   data: UpdateSubscriptionInput,
) {
   const validated = validateInput(updateSubscriptionSchema, data);
   try {
      const [updated] = await db
         .update(contactSubscriptions)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(contactSubscriptions.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Assinatura não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update subscription");
   }
}

export async function listSubscriptionsByTeam(teamId: string, status?: string) {
   try {
      const conditions = [eq(contactSubscriptions.teamId, teamId)];
      if (status) {
         conditions.push(
            eq(
               contactSubscriptions.status,
               status as "active" | "canceled" | "expired" | "paused",
            ),
         );
      }
      return await db
         .select()
         .from(contactSubscriptions)
         .where(and(...conditions));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list subscriptions by team");
   }
}

export async function listSubscriptionsByContact(contactId: string) {
   try {
      return await db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.contactId, contactId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list subscriptions by contact");
   }
}

export async function upsertSubscriptionByExternalId(
   externalId: string,
   data: CreateSubscriptionInput & { teamId: string },
) {
   const validated = validateInput(createSubscriptionSchema, data);
   try {
      const existing = await db.query.contactSubscriptions.findFirst({
         where: { externalId },
      });

      if (existing) {
         const [updated] = await db
            .update(contactSubscriptions)
            .set({
               status: validated.status,
               negotiatedPrice: validated.negotiatedPrice,
               endDate: validated.endDate,
               currentPeriodStart: validated.currentPeriodStart,
               currentPeriodEnd: validated.currentPeriodEnd,
               updatedAt: new Date(),
            })
            .where(eq(contactSubscriptions.id, existing.id))
            .returning();
         if (!updated) throw AppError.database("Failed to upsert subscription");
         return updated;
      }

      const [created] = await db
         .insert(contactSubscriptions)
         .values({ ...validated, teamId: data.teamId, externalId })
         .returning();
      if (!created) throw AppError.database("Failed to upsert subscription");
      return created;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert subscription by external ID");
   }
}

export async function countActiveSubscriptionsByVariant(teamId: string) {
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
               eq(contactSubscriptions.status, "active"),
            ),
         )
         .groupBy(contactSubscriptions.variantId);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         "Failed to count active subscriptions by variant",
      );
   }
}

export async function listExpiringSoon(teamId: string, withinDays = 30) {
   try {
      const now = new Date().toISOString().split("T")[0]!;
      const futureDate = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000)
         .toISOString()
         .split("T")[0]!;

      return await db
         .select()
         .from(contactSubscriptions)
         .where(
            and(
               eq(contactSubscriptions.teamId, teamId),
               eq(contactSubscriptions.status, "active"),
               gte(contactSubscriptions.endDate, now),
               lte(contactSubscriptions.endDate, futureDate),
            ),
         );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list expiring subscriptions");
   }
}
