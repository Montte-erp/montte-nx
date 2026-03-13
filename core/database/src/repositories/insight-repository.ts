import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   insights,
   createInsightSchema,
   updateInsightSchema,
   type CreateInsightInput,
   type UpdateInsightInput,
} from "../schemas/insights";

export async function createInsight(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   createdBy: string,
   data: CreateInsightInput,
) {
   const validated = validateInput(createInsightSchema, data);
   try {
      const [insight] = await db
         .insert(insights)
         .values({ ...validated, organizationId, teamId, createdBy })
         .returning();
      if (!insight) throw AppError.database("Failed to create insight");
      return insight;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create insight");
   }
}

export async function listInsights(
   db: DatabaseInstance,
   organizationId: string,
   type?: string,
) {
   try {
      const conditions = [eq(insights.organizationId, organizationId)];
      if (type) {
         conditions.push(eq(insights.type, type));
      }

      return await db
         .select()
         .from(insights)
         .where(and(...conditions))
         .orderBy(desc(insights.updatedAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list insights");
   }
}

export async function listInsightsByTeam(
   db: DatabaseInstance,
   teamId: string,
   type?: string,
) {
   try {
      const conditions = [eq(insights.teamId, teamId)];
      if (type) {
         conditions.push(eq(insights.type, type));
      }

      return await db
         .select()
         .from(insights)
         .where(and(...conditions))
         .orderBy(desc(insights.updatedAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list insights by team");
   }
}

export async function getInsightById(db: DatabaseInstance, insightId: string) {
   try {
      const [insight] = await db
         .select()
         .from(insights)
         .where(eq(insights.id, insightId));
      return insight ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get insight");
   }
}

export async function getInsightsByIds(
   db: DatabaseInstance,
   insightIds: string[],
) {
   if (insightIds.length === 0) {
      return [];
   }

   try {
      return await db
         .select()
         .from(insights)
         .where(inArray(insights.id, insightIds));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get insights by IDs");
   }
}

export async function updateInsight(
   db: DatabaseInstance,
   insightId: string,
   data: UpdateInsightInput,
) {
   const validated = validateInput(updateInsightSchema, data);
   try {
      const [updated] = await db
         .update(insights)
         .set(validated)
         .where(eq(insights.id, insightId))
         .returning();
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update insight");
   }
}

export async function ensureInsightOwnership(
   db: DatabaseInstance,
   insightId: string,
   organizationId: string,
   teamId: string,
) {
   const insight = await getInsightById(db, insightId);
   if (
      !insight ||
      insight.organizationId !== organizationId ||
      insight.teamId !== teamId
   ) {
      throw AppError.notFound("Insight não encontrado.");
   }
   return insight;
}

export async function deleteInsight(db: DatabaseInstance, insightId: string) {
   try {
      await db.delete(insights).where(eq(insights.id, insightId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete insight");
   }
}
