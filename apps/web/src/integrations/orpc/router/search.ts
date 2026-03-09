import type { DatabaseInstance } from "@core/database/client";
import { actions } from "@core/database/schemas/actions";
import { annotations } from "@core/database/schemas/annotations";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { dashboards } from "@core/database/schemas/dashboards";
import { dataSources } from "@core/database/schemas/data-sources";
import { insights } from "@core/database/schemas/insights";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import { AppError, propagateError } from "@core/utils/errors";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../server";

// ── Per-entity search helpers ────────────────────────────────────────────────

const LIMIT = 5;

async function searchDashboards(
   db: DatabaseInstance,
   teamId: string,
   pattern: string,
) {
   try {
      return await db
         .select({
            id: dashboards.id,
            name: dashboards.name,
            description: dashboards.description,
         })
         .from(dashboards)
         .where(
            and(
               eq(dashboards.teamId, teamId),
               or(
                  ilike(dashboards.name, pattern),
                  ilike(dashboards.description, pattern),
               ),
            ),
         )
         .orderBy(desc(dashboards.updatedAt))
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search dashboards");
   }
}

async function searchInsights(
   db: DatabaseInstance,
   teamId: string,
   pattern: string,
) {
   try {
      return await db
         .select({
            id: insights.id,
            name: insights.name,
            description: insights.description,
            type: insights.type,
         })
         .from(insights)
         .where(
            and(
               eq(insights.teamId, teamId),
               or(
                  ilike(insights.name, pattern),
                  ilike(insights.description, pattern),
               ),
            ),
         )
         .orderBy(desc(insights.updatedAt))
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search insights");
   }
}

async function searchTransactions(
   db: DatabaseInstance,
   teamId: string,
   pattern: string,
) {
   try {
      return await db
         .select({
            id: transactions.id,
            name: transactions.name,
            description: transactions.description,
            type: transactions.type,
            amount: transactions.amount,
            date: transactions.date,
         })
         .from(transactions)
         .where(
            and(
               eq(transactions.teamId, teamId),
               or(
                  ilike(transactions.name, pattern),
                  ilike(transactions.description, pattern),
               ),
            ),
         )
         .orderBy(desc(transactions.date))
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search transactions");
   }
}

async function searchBankAccounts(
   db: DatabaseInstance,
   teamId: string,
   pattern: string,
) {
   try {
      return await db
         .select({
            id: bankAccounts.id,
            name: bankAccounts.name,
            type: bankAccounts.type,
         })
         .from(bankAccounts)
         .where(
            and(
               eq(bankAccounts.teamId, teamId),
               ilike(bankAccounts.name, pattern),
            ),
         )
         .orderBy(desc(bankAccounts.createdAt))
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search bank accounts");
   }
}

async function searchCategories(
   db: DatabaseInstance,
   teamId: string,
   pattern: string,
) {
   try {
      return await db
         .select({
            id: categories.id,
            name: categories.name,
            type: categories.type,
            color: categories.color,
         })
         .from(categories)
         .where(
            and(eq(categories.teamId, teamId), ilike(categories.name, pattern)),
         )
         .orderBy(categories.name)
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search categories");
   }
}

async function searchTags(
   db: DatabaseInstance,
   teamId: string,
   pattern: string,
) {
   try {
      return await db
         .select({ id: tags.id, name: tags.name, color: tags.color })
         .from(tags)
         .where(and(eq(tags.teamId, teamId), ilike(tags.name, pattern)))
         .orderBy(tags.name)
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search tags");
   }
}

async function searchDataSources(
   db: DatabaseInstance,
   organizationId: string,
   pattern: string,
) {
   try {
      return await db
         .select({
            id: dataSources.id,
            name: dataSources.name,
            description: dataSources.description,
            type: dataSources.type,
            isActive: dataSources.isActive,
         })
         .from(dataSources)
         .where(
            and(
               eq(dataSources.organizationId, organizationId),
               or(
                  ilike(dataSources.name, pattern),
                  ilike(dataSources.description, pattern),
               ),
            ),
         )
         .orderBy(desc(dataSources.createdAt))
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search data sources");
   }
}

async function searchAnnotations(
   db: DatabaseInstance,
   organizationId: string,
   pattern: string,
) {
   try {
      return await db
         .select({
            id: annotations.id,
            title: annotations.title,
            description: annotations.description,
            scope: annotations.scope,
            date: annotations.date,
         })
         .from(annotations)
         .where(
            and(
               eq(annotations.organizationId, organizationId),
               or(
                  ilike(annotations.title, pattern),
                  ilike(annotations.description, pattern),
               ),
            ),
         )
         .orderBy(desc(annotations.date))
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search annotations");
   }
}

async function searchActions(
   db: DatabaseInstance,
   organizationId: string,
   pattern: string,
) {
   try {
      return await db
         .select({
            id: actions.id,
            name: actions.name,
            description: actions.description,
            isActive: actions.isActive,
         })
         .from(actions)
         .where(
            and(
               eq(actions.organizationId, organizationId),
               or(
                  ilike(actions.name, pattern),
                  ilike(actions.description, pattern),
               ),
            ),
         )
         .orderBy(desc(actions.createdAt))
         .limit(LIMIT);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to search actions");
   }
}

// ── Procedure ────────────────────────────────────────────────────────────────

export const globalSearch = protectedProcedure
   .input(
      z.object({
         query: z.string().min(1).max(200),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId, organizationId } = context;
      const pattern = `%${input.query}%`;

      const [
         dashboardResults,
         insightResults,
         transactionResults,
         bankAccountResults,
         categoryResults,
         tagResults,
         dataSourceResults,
         annotationResults,
         actionResults,
      ] = await Promise.all([
         searchDashboards(db, teamId, pattern),
         searchInsights(db, teamId, pattern),
         searchTransactions(db, teamId, pattern),
         searchBankAccounts(db, teamId, pattern),
         searchCategories(db, teamId, pattern),
         searchTags(db, teamId, pattern),
         searchDataSources(db, organizationId, pattern),
         searchAnnotations(db, organizationId, pattern),
         searchActions(db, organizationId, pattern),
      ]);

      return {
         dashboards: dashboardResults,
         insights: insightResults,
         transactions: transactionResults,
         bankAccounts: bankAccountResults,
         categories: categoryResults,
         tags: tagResults,
         dataSources: dataSourceResults,
         annotations: annotationResults,
         actions: actionResults,
      };
   });
