import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateCategoryInput,
   type UpdateCategoryInput,
   categories,
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";

type CategorySeed = {
   name: string;
   type: "income" | "expense";
   children?: Array<{ name: string }>;
};

const EMPRESARIAL_CATEGORIES: CategorySeed[] = [
   {
      name: "Vendas",
      type: "income",
      children: [{ name: "Produtos" }, { name: "Serviços" }],
   },
   { name: "Outras Receitas", type: "income" },
   {
      name: "Custos",
      type: "expense",
      children: [
         { name: "CMV" },
         { name: "Serviços de Terceiros" },
      ],
   },
   {
      name: "Despesas Operacionais",
      type: "expense",
      children: [
         { name: "Administrativo" },
         { name: "Comercial" },
         { name: "Marketing" },
      ],
   },
   { name: "Pessoal", type: "expense" },
   { name: "Impostos", type: "expense" },
   { name: "Tarifas Bancárias", type: "expense" },
   { name: "Tecnologia", type: "expense" },
   { name: "Transferências", type: "expense" },
];

export async function createCategory(
   db: DatabaseInstance,
   teamId: string,
   data: CreateCategoryInput,
) {
   const validated = validateInput(createCategorySchema, data);
   try {
      let level = 1;
      let type = validated.type;

      if (validated.parentId) {
         const parentId = validated.parentId;
         const parent = await db.query.categories.findFirst({
            where: (fields, { eq }) => eq(fields.id, parentId),
         });
         if (!parent) throw AppError.notFound("Categoria pai não encontrada.");
         if (parent.level >= 3) {
            throw AppError.validation("Limite de 3 níveis atingido.");
         }
         level = parent.level + 1;
         type = parent.type;
      }

      if (validated.keywords?.length) {
         await validateKeywordsUniqueness(db, teamId, validated.keywords);
      }

      const [category] = await db
         .insert(categories)
         .values({
            ...validated,
            teamId,
            level,
            type,
         })
         .returning();
      if (!category) throw AppError.database("Failed to create category");
      return category;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create category");
   }
}

export async function seedEmpresarialCategories(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      for (const root of EMPRESARIAL_CATEGORIES) {
         const [parent] = await db
            .insert(categories)
            .values({
               teamId,
               name: root.name,
               type: root.type,
               level: 1,
               isDefault: true,
            })
            .returning();
         if (!parent) throw AppError.database("Failed to seed category");

         if (root.children?.length) {
            await db.insert(categories).values(
               root.children.map((child) => ({
                  teamId,
                  name: child.name,
                  type: root.type,
                  parentId: parent.id,
                  level: 2,
                  isDefault: true,
               })),
            );
         }
      }
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to seed empresarial categories");
   }
}

export async function listCategories(
   db: DatabaseInstance,
   teamId: string,
   opts?: {
      type?: "income" | "expense";
      includeArchived?: boolean;
   },
) {
   try {
      if (opts?.type) {
         const type = opts.type;
         if (opts.includeArchived) {
            return await db.query.categories.findMany({
               where: (fields, { and, eq }) =>
                  and(eq(fields.teamId, teamId), eq(fields.type, type)),
               orderBy: (fields, { asc }) => [asc(fields.name)],
            });
         }
         return await db.query.categories.findMany({
            where: (fields, { and, eq }) =>
               and(
                  eq(fields.teamId, teamId),
                  eq(fields.type, type),
                  eq(fields.isArchived, false),
               ),
            orderBy: (fields, { asc }) => [asc(fields.name)],
         });
      }
      if (opts?.includeArchived) {
         return await db.query.categories.findMany({
            where: (fields, { eq }) => eq(fields.teamId, teamId),
            orderBy: (fields, { asc }) => [asc(fields.name)],
         });
      }
      return await db.query.categories.findMany({
         where: (fields, { and, eq }) =>
            and(eq(fields.teamId, teamId), eq(fields.isArchived, false)),
         orderBy: (fields, { asc }) => [asc(fields.name)],
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list categories");
   }
}

export async function ensureCategoryOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const category = await getCategory(db, id);
   if (!category || category.teamId !== teamId) {
      throw AppError.notFound("Categoria não encontrada.");
   }
   return category;
}

export async function getCategory(db: DatabaseInstance, id: string) {
   try {
      const category = await db.query.categories.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      return category ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get category");
   }
}

export async function updateCategory(
   db: DatabaseInstance,
   id: string,
   data: UpdateCategoryInput,
) {
   const validated = validateInput(updateCategorySchema, data);
   try {
      const existing = await db.query.categories.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      if (!existing) throw AppError.notFound("Categoria não encontrada.");
      if (existing.isDefault) {
         throw AppError.conflict("Categorias padrão não podem ser editadas.");
      }

      if (validated.keywords?.length) {
         await validateKeywordsUniqueness(
            db,
            existing.teamId,
            validated.keywords,
            id,
         );
      }

      const [updated] = await db
         .update(categories)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(categories.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Categoria não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update category");
   }
}

export async function archiveCategory(db: DatabaseInstance, id: string) {
   try {
      const existing = await db.query.categories.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      if (!existing) throw AppError.notFound("Categoria não encontrada.");
      if (existing.isDefault) {
         throw AppError.conflict("Categorias padrão não podem ser arquivadas.");
      }

      const descendantIds = await getDescendantIds(db, id);
      const allIds = [id, ...descendantIds];

      await db
         .update(categories)
         .set({ isArchived: true, updatedAt: new Date() })
         .where(inArray(categories.id, allIds));

      return await db.query.categories.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive category");
   }
}

export async function reactivateCategory(db: DatabaseInstance, id: string) {
   try {
      const [updated] = await db
         .update(categories)
         .set({ isArchived: false, updatedAt: new Date() })
         .where(eq(categories.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Categoria não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate category");
   }
}

export async function deleteCategory(db: DatabaseInstance, id: string) {
   try {
      const existing = await db.query.categories.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      if (!existing) throw AppError.notFound("Categoria não encontrada.");
      if (existing.isDefault) {
         throw AppError.conflict("Categorias padrão não podem ser excluídas.");
      }

      const hasTransactions = await categoryTreeHasTransactions(db, id);
      if (hasTransactions) {
         throw AppError.conflict(
            "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
         );
      }

      await db.delete(categories).where(eq(categories.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete category");
   }
}

export async function bulkDeleteCategories(
   db: DatabaseInstance,
   ids: string[],
   teamId: string,
) {
   try {
      const existing = await db.query.categories.findMany({
         where: (fields, { and, inArray, eq }) =>
            and(inArray(fields.id, ids), eq(fields.teamId, teamId)),
      });
      if (existing.length !== ids.length) {
         throw AppError.notFound("Uma ou mais categorias não foram encontradas.");
      }
      const defaultOne = existing.find((c) => c.isDefault);
      if (defaultOne) {
         throw AppError.conflict("Categorias padrão não podem ser excluídas.");
      }
      const allDescendantIds = (
         await Promise.all(ids.map((id) => getDescendantIds(db, id)))
      ).flat();
      const allIds = [...new Set([...ids, ...allDescendantIds])];
      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactions)
         .where(inArray(transactions.categoryId, allIds));
      if ((row?.count ?? 0) > 0) {
         throw AppError.conflict(
            "Categorias com lançamentos não podem ser excluídas. Use arquivamento.",
         );
      }
      await db.delete(categories).where(inArray(categories.id, ids));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to bulk delete categories");
   }
}

export async function categoryTreeHasTransactions(
   db: DatabaseInstance,
   categoryId: string,
): Promise<boolean> {
   try {
      const descendantIds = await getDescendantIds(db, categoryId);
      const allIds = [categoryId, ...descendantIds];

      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactions)
         .where(inArray(transactions.categoryId, allIds));
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check category transactions");
   }
}

async function getDescendantIds(
   db: DatabaseInstance,
   categoryId: string,
): Promise<string[]> {
   const level2 = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, categoryId));

   const level2Ids = level2.map((r) => r.id);
   if (level2Ids.length === 0) return [];

   const level3 = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.parentId, level2Ids));

   return [...level2Ids, ...level3.map((r) => r.id)];
}

export async function validateKeywordsUniqueness(
   db: DatabaseInstance,
   teamId: string,
   keywords: string[],
   excludeCategoryId?: string,
) {
   const conditions: SQL[] = [
      eq(categories.teamId, teamId),
      eq(categories.isArchived, false),
      sql`${categories.keywords} && ARRAY[${sql.join(
         keywords.map((k) => sql`${k}`),
         sql`,`,
      )}]::text[]`,
   ];

   if (excludeCategoryId) {
      conditions.push(sql`${categories.id} != ${excludeCategoryId}`);
   }

   const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(and(...conditions));

   if ((row?.count ?? 0) > 0) {
      throw AppError.conflict(
         "Palavras-chave já utilizadas em outra categoria ativa.",
      );
   }
}
