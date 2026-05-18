import { os } from "@orpc/server";
import { Result, TaggedError, type Result as ResultType } from "better-result";
import { defineErrorCatalog } from "evlog";
import { and, eq, inArray, sql } from "drizzle-orm";
import { categories, type Category } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

const classificationRouterErrors = defineErrorCatalog("classification.router", {
   BAD_REQUEST: {
      status: 400,
      message: "Requisição inválida em classificação.",
      tags: ["classification", "router"],
   },
   CONFLICT: {
      status: 409,
      message: "Conflito em classificação.",
      tags: ["classification", "router"],
   },
   FORBIDDEN: {
      status: 403,
      message: "Ação não permitida em classificação.",
      tags: ["classification", "router"],
   },
   INTERNAL: {
      status: 500,
      message: "Falha interna em classificação.",
      tags: ["classification", "router"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Registro de classificação não encontrado.",
      tags: ["classification", "router"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "classification.router": typeof classificationRouterErrors;
   }
}

type ClassificationRouterCatalogError =
   | ReturnType<typeof classificationRouterErrors.BAD_REQUEST>
   | ReturnType<typeof classificationRouterErrors.CONFLICT>
   | ReturnType<typeof classificationRouterErrors.FORBIDDEN>
   | ReturnType<typeof classificationRouterErrors.INTERNAL>
   | ReturnType<typeof classificationRouterErrors.NOT_FOUND>;

export class ClassificationRouterError extends TaggedError(
   "ClassificationRouterError",
)<{
   error: ClassificationRouterCatalogError;
   message: string;
}>() {}

const makeRouterError = (
   error: ClassificationRouterCatalogError,
   message: string,
) => new ClassificationRouterError({ error, message });

export const classificationBadRequest = (message: string) =>
   makeRouterError(classificationRouterErrors.BAD_REQUEST(), message);

export const classificationConflict = (message: string) =>
   makeRouterError(classificationRouterErrors.CONFLICT(), message);

export const classificationForbidden = (message: string) =>
   makeRouterError(classificationRouterErrors.FORBIDDEN(), message);

export const classificationInternal = (message: string) =>
   makeRouterError(classificationRouterErrors.INTERNAL(), message);

export const classificationNotFound = (message: string) =>
   makeRouterError(classificationRouterErrors.NOT_FOUND(), message);

type ResolvedCategoryUpdateParent = {
   updateParent: boolean;
   level: number;
   type: Category["type"];
   descendantCategoryIds: string[];
};

const dbError = (message: string) => () => classificationInternal(message);

export const requireCategory = base.middleware(
   async ({ context, next }, id: string) => {
      const category = await Result.tryPromise({
         try: () =>
            context.db.query.categories.findFirst({
               where: (f, { eq }) => eq(f.id, id),
            }),
         catch: dbError("Falha ao verificar permissão."),
      });
      if (Result.isError(category)) throw category.error;
      if (!category.value || category.value.teamId !== context.teamId) {
         throw classificationNotFound("Categoria não encontrada.");
      }
      return next({ context: { category: category.value } });
   },
);

export const requireTag = base.middleware(
   async ({ context, next }, id: string) => {
      const tag = await Result.tryPromise({
         try: () =>
            context.db.query.tags.findFirst({
               where: (f, { eq }) => eq(f.id, id),
            }),
         catch: dbError("Falha ao verificar permissão."),
      });
      if (Result.isError(tag)) throw tag.error;
      if (!tag.value || tag.value.teamId !== context.teamId) {
         throw classificationNotFound("Centro de custo não encontrado.");
      }
      return next({ context: { tag: tag.value } });
   },
);

export const requireOwnedCategoryIds = base.middleware(
   async ({ context, next }, ids: string[]) => {
      const rows = await Result.tryPromise({
         try: () =>
            context.db.query.categories.findMany({
               where: (f, { and, inArray, eq }) =>
                  and(inArray(f.id, ids), eq(f.teamId, context.teamId)),
            }),
         catch: dbError("Falha ao verificar categorias."),
      });
      if (Result.isError(rows)) throw rows.error;
      if (rows.value.length !== ids.length) {
         throw classificationNotFound(
            "Uma ou mais categorias não foram encontradas.",
         );
      }
      return next({ context: { ownedCategories: rows.value } });
   },
);

export const blockDefaultCategories = os
   .$context<
      ORPCContextWithOrganization & {
         ownedCategories: { isDefault: boolean }[];
      }
   >()
   .middleware(async ({ context, next }, message: string) => {
      if (context.ownedCategories.some((c) => c.isDefault)) {
         throw classificationConflict(message);
      }
      return next();
   });

export const requireKeywordsUnique = base.middleware(
   async (
      { context, next },
      args: { keywords: string[] | null | undefined; excludeId?: string },
   ) => {
      const { keywords, excludeId } = args;
      if (!keywords?.length) return next();

      const conds = [
         eq(categories.teamId, context.teamId),
         eq(categories.isArchived, false),
         sql`${categories.keywords} && ARRAY[${sql.join(
            keywords.map((k) => sql`${k}`),
            sql`,`,
         )}]::text[]`,
      ];
      if (excludeId) conds.push(sql`${categories.id} != ${excludeId}`);

      const countResult = await Result.tryPromise({
         try: () =>
            context.db
               .select({ count: sql<number>`count(*)::int` })
               .from(categories)
               .where(and(...conds))
               .then((rows) => rows[0]?.count ?? 0),
         catch: dbError("Falha ao validar palavras-chave."),
      });
      if (Result.isError(countResult)) throw countResult.error;
      if (countResult.value > 0) {
         throw classificationConflict(
            "Palavras-chave já utilizadas em outra categoria ativa.",
         );
      }
      return next();
   },
);

export const requireResolvedCategoryParent = base.middleware(
   async (
      { context, next },
      args: {
         parentId: string | null | undefined;
         type: "income" | "expense" | "transfer";
      },
   ) => {
      const { parentId, type } = args;
      if (!parentId)
         return next({ context: { resolvedParent: { level: 1, type } } });

      const parent = await Result.tryPromise({
         try: () =>
            context.db.query.categories.findFirst({
               where: (f, { eq }) => eq(f.id, parentId),
            }),
         catch: dbError("Falha ao verificar categoria pai."),
      });
      if (Result.isError(parent)) throw parent.error;
      if (!parent.value || parent.value.teamId !== context.teamId) {
         throw classificationNotFound("Categoria pai não encontrada.");
      }
      if (parent.value.level >= 3) {
         throw classificationBadRequest("Limite de 3 níveis atingido.");
      }
      return next({
         context: {
            resolvedParent: {
               level: parent.value.level + 1,
               type: parent.value.type,
            },
         },
      });
   },
);

export const requireResolvedCategoryUpdateParent = os
   .$context<
      ORPCContextWithOrganization & {
         category: Category;
      }
   >()
   .middleware(
      async (
         { context, next },
         args: { parentId: string | null | undefined },
      ) => {
         const { parentId } = args;
         if (parentId === undefined) {
            const resolvedParent: ResolvedCategoryUpdateParent = {
               updateParent: false,
               level: context.category.level,
               type: context.category.type,
               descendantCategoryIds: [],
            };
            return next({ context: { resolvedParent } });
         }

         const descendantsResult = await fetchDescendantRows(
            context.db,
            context.category.id,
         );
         if (Result.isError(descendantsResult)) throw descendantsResult.error;
         const descendantCategoryIds = descendantsResult.value.map((r) => r.id);
         const maxDepth = descendantsResult.value.reduce(
            (max, row) => Math.max(max, row.level - context.category.level + 1),
            1,
         );

         if (!parentId) {
            if (maxDepth > 3)
               throw classificationBadRequest("Limite de 3 níveis atingido.");
            const resolvedParent: ResolvedCategoryUpdateParent = {
               updateParent: true,
               level: 1,
               type: context.category.type,
               descendantCategoryIds,
            };
            return next({ context: { resolvedParent } });
         }

         if (parentId === context.category.id) {
            throw classificationBadRequest(
               "Categoria pai não pode ser a própria categoria.",
            );
         }
         if (descendantCategoryIds.includes(parentId)) {
            throw classificationBadRequest(
               "Categoria pai não pode ser uma subcategoria da categoria editada.",
            );
         }

         const parent = await Result.tryPromise({
            try: () =>
               context.db.query.categories.findFirst({
                  where: (f, { eq }) => eq(f.id, parentId),
               }),
            catch: dbError("Falha ao verificar categoria pai."),
         });
         if (Result.isError(parent)) throw parent.error;
         if (!parent.value || parent.value.teamId !== context.teamId) {
            throw classificationNotFound("Categoria pai não encontrada.");
         }
         if (parent.value.isArchived) {
            throw classificationBadRequest("Categoria pai arquivada.");
         }

         const nextLevel = parent.value.level + 1;
         if (nextLevel + maxDepth - 1 > 3) {
            throw classificationBadRequest("Limite de 3 níveis atingido.");
         }

         const resolvedParent: ResolvedCategoryUpdateParent = {
            updateParent: true,
            level: nextLevel,
            type: parent.value.type,
            descendantCategoryIds,
         };
         return next({ context: { resolvedParent } });
      },
   );

function fetchDescendantRows(
   db: ORPCContextWithOrganization["db"],
   categoryId: string,
) {
   return Result.tryPromise({
      try: async () => {
         const level2 = await db
            .select({ id: categories.id, level: categories.level })
            .from(categories)
            .where(eq(categories.parentId, categoryId));
         if (level2.length === 0) return [];
         const level2Ids = level2.map((r) => r.id);
         const level3 = await db
            .select({ id: categories.id, level: categories.level })
            .from(categories)
            .where(inArray(categories.parentId, level2Ids));
         return [...level2, ...level3];
      },
      catch: dbError("Falha ao verificar descendentes."),
   });
}

async function fetchDescendantIds(
   db: ORPCContextWithOrganization["db"],
   categoryId: string,
): Promise<ResultType<string[], ClassificationRouterError>> {
   const rows = await fetchDescendantRows(db, categoryId);
   if (Result.isError(rows)) return Result.err(rows.error);
   return Result.ok(rows.value.map((row) => row.id));
}

export const requireEmptyCategoryTree = base.middleware(
   async ({ context, next }, id: string) => {
      const descendants = await fetchDescendantIds(context.db, id);
      if (Result.isError(descendants)) throw descendants.error;
      const allIds = [id, ...descendants.value];
      const countResult = await Result.tryPromise({
         try: () =>
            context.db
               .select({ count: sql<number>`count(*)::int` })
               .from(transactions)
               .where(inArray(transactions.categoryId, allIds))
               .then((rows) => rows[0]?.count ?? 0),
         catch: dbError("Falha ao verificar lançamentos."),
      });
      if (Result.isError(countResult)) throw countResult.error;
      if (countResult.value > 0) {
         throw classificationConflict(
            "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
         );
      }
      return next();
   },
);

export const withExpandedCategoryIds = base.middleware(
   async ({ context, next }, ids: string[]) => {
      const lists: string[][] = [];
      for (const id of ids) {
         const descendants = await fetchDescendantIds(context.db, id);
         if (Result.isError(descendants)) throw descendants.error;
         lists.push(descendants.value);
      }
      return next({
         context: {
            expandedCategoryIds: [...new Set([...ids, ...lists.flat()])],
         },
      });
   },
);

export const requireNoTransactionsForExpandedIds = os
   .$context<ORPCContextWithOrganization & { expandedCategoryIds: string[] }>()
   .middleware(async ({ context, next }) => {
      const countResult = await Result.tryPromise({
         try: () =>
            context.db
               .select({ count: sql<number>`count(*)::int` })
               .from(transactions)
               .where(
                  inArray(transactions.categoryId, context.expandedCategoryIds),
               )
               .then((rows) => rows[0]?.count ?? 0),
         catch: dbError("Falha ao verificar lançamentos."),
      });
      if (Result.isError(countResult)) throw countResult.error;
      if (countResult.value > 0) {
         throw classificationConflict(
            "Categorias com lançamentos não podem ser excluídas. Use arquivamento.",
         );
      }
      return next();
   });

export const withCategoryDescendants = base.middleware(
   async ({ context, next }, id: string) => {
      const descendants = await fetchDescendantIds(context.db, id);
      if (Result.isError(descendants)) throw descendants.error;
      return next({ context: { descendantCategoryIds: descendants.value } });
   },
);
