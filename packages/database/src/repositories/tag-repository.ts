import { AppError, propagateError } from "@packages/utils/errors";
import { and, count, eq, ilike, inArray, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { financialGoal } from "../schemas/goals";
import { billTag, tag, transactionTag } from "../schemas/tags";

export type Tag = typeof tag.$inferSelect;
export type NewTag = typeof tag.$inferInsert;
export type TransactionTag = typeof transactionTag.$inferSelect;
export type NewTransactionTag = typeof transactionTag.$inferInsert;
export type BillTag = typeof billTag.$inferSelect;
export type NewBillTag = typeof billTag.$inferInsert;

export async function createTag(dbClient: DatabaseInstance, data: NewTag) {
   try {
      const result = await dbClient.insert(tag).values(data).returning();
      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict("Tag already exists for this organization", {
            cause: err,
         });
      }

      propagateError(err);
      throw AppError.database(`Failed to create tag: ${error.message}`, {
         cause: err,
      });
   }
}

export async function findTagById(dbClient: DatabaseInstance, tagId: string) {
   try {
      const result = await dbClient.query.tag.findFirst({
         where: (tag, { eq }) => eq(tag.id, tagId),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find tag by id: ${(err as Error).message}`,
      );
   }
}

export async function findTagsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.query.tag.findMany({
         orderBy: (tag, { asc }) => asc(tag.name),
         where: (tag, { eq }) => eq(tag.organizationId, organizationId),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find tags by organization id: ${(err as Error).message}`,
      );
   }
}

export async function findTagsByOrganizationIdPaginated(
   dbClient: DatabaseInstance,
   organizationId: string,
   options: {
      page?: number;
      limit?: number;
      orderBy?: "name" | "createdAt" | "updatedAt";
      orderDirection?: "asc" | "desc";
      search?: string;
   } = {},
) {
   const {
      page = 1,
      limit = 10,
      orderBy = "name",
      orderDirection = "asc",
      search,
   } = options;

   const offset = (page - 1) * limit;

   try {
      const baseWhereCondition = eq(tag.organizationId, organizationId);
      const whereCondition = search
         ? and(baseWhereCondition, ilike(tag.name, `%${search}%`))
         : baseWhereCondition;

      const [tags, totalCount] = await Promise.all([
         dbClient.query.tag.findMany({
            limit,
            offset,
            orderBy: (tag, { asc, desc }) => {
               const column = tag[orderBy as keyof typeof tag];
               return orderDirection === "asc" ? asc(column) : desc(column);
            },
            where: whereCondition,
         }),
         dbClient.query.tag
            .findMany({
               where: whereCondition,
            })
            .then((result) => result.length),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
         pagination: {
            currentPage: page,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            limit,
            totalCount,
            totalPages,
         },
         tags,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find tags by organization id paginated: ${(err as Error).message}`,
      );
   }
}

export async function updateTag(
   dbClient: DatabaseInstance,
   tagId: string,
   data: Partial<NewTag>,
) {
   try {
      const existingTag = await findTagById(dbClient, tagId);
      if (!existingTag) {
         throw AppError.notFound("Tag not found");
      }

      const result = await dbClient
         .update(tag)
         .set(data)
         .where(eq(tag.id, tagId))
         .returning();

      if (!result.length) {
         throw AppError.database("Tag not found");
      }

      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict("Tag already exists for this organization", {
            cause: err,
         });
      }

      if (err instanceof AppError) {
         throw err;
      }

      propagateError(err);
      throw AppError.database(`Failed to update tag: ${error.message}`, {
         cause: err,
      });
   }
}

export async function deleteTag(dbClient: DatabaseInstance, tagId: string) {
   try {
      const result = await dbClient
         .delete(tag)
         .where(eq(tag.id, tagId))
         .returning();

      if (!result.length) {
         throw AppError.database("Tag not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete tag: ${(err as Error).message}`,
      );
   }
}

export async function deleteManyTags(
   dbClient: DatabaseInstance,
   tagIds: string[],
   organizationId: string,
) {
   if (tagIds.length === 0) {
      return [];
   }

   try {
      const result = await dbClient
         .delete(tag)
         .where(
            and(
               inArray(tag.id, tagIds),
               eq(tag.organizationId, organizationId),
            ),
         )
         .returning();

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete tags: ${(err as Error).message}`,
      );
   }
}

export async function getTotalTagsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient
         .select({ count: count() })
         .from(tag)
         .where(eq(tag.organizationId, organizationId));

      return result[0]?.count || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total tags: ${(err as Error).message}`,
      );
   }
}

export async function searchTags(
   dbClient: DatabaseInstance,
   organizationId: string,
   query: string,
   options: {
      limit?: number;
      includeTransactionCount?: boolean;
   } = {},
) {
   const { limit = 20, includeTransactionCount = false } = options;

   try {
      if (includeTransactionCount) {
         const result = await dbClient.execute<{
            id: string;
            name: string;
            color: string;
            organizationId: string;
            createdAt: Date;
            updatedAt: Date;
            transactionCount: string;
         }>(sql`
            SELECT
               t.*,
               COUNT(tt.transaction_id) as "transactionCount"
            FROM ${tag} t
            LEFT JOIN ${transactionTag} tt ON t.id = tt.tag_id
            WHERE
               t.organization_id = ${organizationId}
               AND t.name ILIKE ${`%${query}%`}
            GROUP BY t.id
            ORDER BY t.name ASC
            LIMIT ${limit}
         `);

         return result.rows.map((row) => ({
            ...row,
            transactionCount: parseInt(row.transactionCount, 10),
         }));
      }

      const result = await dbClient.query.tag.findMany({
         limit,
         orderBy: (tag, { asc }) => asc(tag.name),
         where: and(
            eq(tag.organizationId, organizationId),
            ilike(tag.name, `%${query}%`),
         ),
      });

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to search tags: ${(err as Error).message}`,
      );
   }
}

export async function addTagToTransaction(
   dbClient: DatabaseInstance,
   transactionId: string,
   tagId: string,
) {
   try {
      const result = await dbClient
         .insert(transactionTag)
         .values({ tagId, transactionId })
         .returning();

      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict("Tag already linked to this transaction", {
            cause: err,
         });
      }

      propagateError(err);
      throw AppError.database(
         `Failed to add tag to transaction: ${error.message}`,
         { cause: err },
      );
   }
}

export async function removeTagFromTransaction(
   dbClient: DatabaseInstance,
   transactionId: string,
   tagId: string,
) {
   try {
      const result = await dbClient
         .delete(transactionTag)
         .where(
            and(
               eq(transactionTag.transactionId, transactionId),
               eq(transactionTag.tagId, tagId),
            ),
         )
         .returning();

      if (!result.length) {
         throw AppError.notFound("Tag not linked to this transaction");
      }

      return result[0];
   } catch (err) {
      if (err instanceof AppError) {
         throw err;
      }
      propagateError(err);
      throw AppError.database(
         `Failed to remove tag from transaction: ${(err as Error).message}`,
      );
   }
}

export async function setTransactionTags(
   dbClient: DatabaseInstance,
   transactionId: string,
   tagIds: string[],
) {
   try {
      await dbClient
         .delete(transactionTag)
         .where(eq(transactionTag.transactionId, transactionId));

      if (tagIds.length === 0) {
         return [];
      }

      const result = await dbClient
         .insert(transactionTag)
         .values(tagIds.map((tagId) => ({ tagId, transactionId })))
         .returning();

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to set transaction tags: ${(err as Error).message}`,
      );
   }
}

export async function findTagsByTransactionId(
   dbClient: DatabaseInstance,
   transactionId: string,
) {
   try {
      const result = await dbClient
         .select({
            color: tag.color,
            createdAt: tag.createdAt,
            id: tag.id,
            name: tag.name,
            organizationId: tag.organizationId,
            updatedAt: tag.updatedAt,
         })
         .from(transactionTag)
         .innerJoin(tag, eq(transactionTag.tagId, tag.id))
         .where(eq(transactionTag.transactionId, transactionId))
         .orderBy(tag.name);

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find tags by transaction id: ${(err as Error).message}`,
      );
   }
}

export async function findTransactionsByTagId(
   dbClient: DatabaseInstance,
   tagId: string,
   options: {
      page?: number;
      limit?: number;
   } = {},
) {
   const { page = 1, limit = 10 } = options;
   const offset = (page - 1) * limit;

   try {
      const transactionIds = await dbClient
         .select({ transactionId: transactionTag.transactionId })
         .from(transactionTag)
         .where(eq(transactionTag.tagId, tagId));

      const ids = transactionIds.map((t) => t.transactionId);

      if (ids.length === 0) {
         return {
            pagination: {
               currentPage: page,
               hasNextPage: false,
               hasPreviousPage: false,
               limit,
               totalCount: 0,
               totalPages: 0,
            },
            transactions: [],
         };
      }

      const [transactions, totalCount] = await Promise.all([
         dbClient.query.transaction.findMany({
            limit,
            offset,
            orderBy: (transaction, { desc }) => desc(transaction.date),
            where: (transaction, { inArray }) => inArray(transaction.id, ids),
            with: {
               bankAccount: true,
               costCenter: true,
               transactionCategories: {
                  with: {
                     category: true,
                  },
               },
               transactionTags: {
                  with: {
                     tag: true,
                  },
               },
            },
         }),
         Promise.resolve(ids.length),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
         pagination: {
            currentPage: page,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            limit,
            totalCount,
            totalPages,
         },
         transactions,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transactions by tag id: ${(err as Error).message}`,
      );
   }
}

export async function getTagWithMostTransactions(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.execute<{
         tagId: string;
         tagName: string;
         transactionCount: string;
      }>(sql`
         SELECT
            t.id as "tagId",
            t.name as "tagName",
            COUNT(tt.transaction_id) as "transactionCount"
         FROM ${tag} t
         LEFT JOIN ${transactionTag} tt ON t.id = tt.tag_id
         WHERE t.organization_id = ${organizationId}
         GROUP BY t.id, t.name
         ORDER BY "transactionCount" DESC
         LIMIT 1
      `);

      const rows = result.rows;
      if (!rows || rows.length === 0) return null;

      return {
         tagId: rows[0]?.tagId,
         tagName: rows[0]?.tagName,
         transactionCount: parseInt(rows[0]?.transactionCount ?? "", 10),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get tag with most transactions: ${(err as Error).message}`,
      );
   }
}

export async function findTagsByIds(
   dbClient: DatabaseInstance,
   tagIds: string[],
) {
   if (tagIds.length === 0) {
      return [];
   }

   try {
      const result = await dbClient.query.tag.findMany({
         where: inArray(tag.id, tagIds),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find tags by ids: ${(err as Error).message}`,
      );
   }
}

export async function findTagsWithoutGoal(
   dbClient: DatabaseInstance,
   organizationId: string,
): Promise<Tag[]> {
   try {
      // Get all tags that don't have a linked goal
      const result = await dbClient
         .select({
            color: tag.color,
            createdAt: tag.createdAt,
            id: tag.id,
            name: tag.name,
            organizationId: tag.organizationId,
            updatedAt: tag.updatedAt,
         })
         .from(tag)
         .leftJoin(financialGoal, eq(tag.id, financialGoal.tagId))
         .where(
            and(
               eq(tag.organizationId, organizationId),
               sql`${financialGoal.id} IS NULL`,
            ),
         )
         .orderBy(tag.name);

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find tags without goal: ${(err as Error).message}`,
      );
   }
}

// Bill Tag Functions

export async function addTagToBill(
   dbClient: DatabaseInstance,
   billId: string,
   tagId: string,
) {
   try {
      const result = await dbClient
         .insert(billTag)
         .values({ billId, tagId })
         .returning();

      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict("Tag already linked to this bill", {
            cause: err,
         });
      }

      propagateError(err);
      throw AppError.database(`Failed to add tag to bill: ${error.message}`, {
         cause: err,
      });
   }
}

export async function removeTagFromBill(
   dbClient: DatabaseInstance,
   billId: string,
   tagId: string,
) {
   try {
      const result = await dbClient
         .delete(billTag)
         .where(and(eq(billTag.billId, billId), eq(billTag.tagId, tagId)))
         .returning();

      if (!result.length) {
         throw AppError.notFound("Tag not linked to this bill");
      }

      return result[0];
   } catch (err) {
      if (err instanceof AppError) {
         throw err;
      }
      propagateError(err);
      throw AppError.database(
         `Failed to remove tag from bill: ${(err as Error).message}`,
      );
   }
}

export async function setBillTags(
   dbClient: DatabaseInstance,
   billId: string,
   tagIds: string[],
) {
   try {
      return await dbClient.transaction(async (tx) => {
         await tx.delete(billTag).where(eq(billTag.billId, billId));

         if (tagIds.length === 0) {
            return [];
         }

         const result = await tx
            .insert(billTag)
            .values(tagIds.map((tagId) => ({ billId, tagId })))
            .returning();

         return result;
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to set bill tags: ${(err as Error).message}`,
      );
   }
}

export async function findTagsByBillId(
   dbClient: DatabaseInstance,
   billId: string,
) {
   try {
      const result = await dbClient
         .select({
            color: tag.color,
            createdAt: tag.createdAt,
            id: tag.id,
            name: tag.name,
            organizationId: tag.organizationId,
            updatedAt: tag.updatedAt,
         })
         .from(billTag)
         .innerJoin(tag, eq(billTag.tagId, tag.id))
         .where(eq(billTag.billId, billId))
         .orderBy(tag.name);

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find tags by bill id: ${(err as Error).message}`,
      );
   }
}
