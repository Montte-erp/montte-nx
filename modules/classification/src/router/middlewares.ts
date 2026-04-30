import { os } from "@orpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
   err,
   errAsync,
   fromPromise,
   ok,
   okAsync,
   ResultAsync,
} from "neverthrow";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

const dbErr = (msg: string) => () => WebAppError.internal(msg);

export const requireCategory = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.categories.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         dbErr("Falha ao verificar permissão."),
      ).andThen((category) =>
         !category || category.teamId !== context.teamId
            ? err(WebAppError.notFound("Categoria não encontrada."))
            : ok(category),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { category: result.value } });
   },
);

export const requireTag = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.tags.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         dbErr("Falha ao verificar permissão."),
      ).andThen((tag) =>
         !tag || tag.teamId !== context.teamId
            ? err(WebAppError.notFound("Centro de custo não encontrado."))
            : ok(tag),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { tag: result.value } });
   },
);

export const requireOwnedCategoryIds = base.middleware(
   async ({ context, next }, ids: string[]) => {
      const result = await fromPromise(
         context.db.query.categories.findMany({
            where: (f, { and, inArray, eq }) =>
               and(inArray(f.id, ids), eq(f.teamId, context.teamId)),
         }),
         dbErr("Falha ao verificar categorias."),
      ).andThen((rows) =>
         rows.length !== ids.length
            ? err(
                 WebAppError.notFound(
                    "Uma ou mais categorias não foram encontradas.",
                 ),
              )
            : ok(rows),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { ownedCategories: result.value } });
   },
);

export const blockDefaultCategories = os
   .$context<
      ORPCContextWithOrganization & {
         ownedCategories: { isDefault: boolean }[];
      }
   >()
   .middleware(async ({ context, next }, message: string) => {
      if (context.ownedCategories.some((c) => c.isDefault))
         throw WebAppError.conflict(message);
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

      const result = await fromPromise(
         context.db
            .select({ count: sql<number>`count(*)::int` })
            .from(categories)
            .where(and(...conds))
            .then((rows) => rows[0]?.count ?? 0),
         dbErr("Falha ao validar palavras-chave."),
      ).andThen((count) =>
         count > 0
            ? err(
                 WebAppError.conflict(
                    "Palavras-chave já utilizadas em outra categoria ativa.",
                 ),
              )
            : ok(undefined),
      );
      if (result.isErr()) throw result.error;
      return next();
   },
);

export const requireResolvedCategoryParent = base.middleware(
   async (
      { context, next },
      args: { parentId: string | null | undefined; type: "income" | "expense" },
   ) => {
      const { parentId, type } = args;
      if (!parentId)
         return next({ context: { resolvedParent: { level: 1, type } } });

      const result = await fromPromise(
         context.db.query.categories.findFirst({
            where: (f, { eq }) => eq(f.id, parentId),
         }),
         dbErr("Falha ao verificar categoria pai."),
      ).andThen((parent) => {
         if (!parent || parent.teamId !== context.teamId)
            return err(WebAppError.notFound("Categoria pai não encontrada."));
         if (parent.level >= 3)
            return err(WebAppError.badRequest("Limite de 3 níveis atingido."));
         return ok({ level: parent.level + 1, type: parent.type });
      });
      if (result.isErr()) throw result.error;
      return next({ context: { resolvedParent: result.value } });
   },
);

function fetchDescendantIds(
   db: ORPCContextWithOrganization["db"],
   categoryId: string,
) {
   return fromPromise(
      (async () => {
         const level2 = await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.parentId, categoryId));
         if (level2.length === 0) return [] as string[];
         const level2Ids = level2.map((r) => r.id);
         const level3 = await db
            .select({ id: categories.id })
            .from(categories)
            .where(inArray(categories.parentId, level2Ids));
         return [...level2Ids, ...level3.map((r) => r.id)];
      })(),
      dbErr("Falha ao verificar descendentes."),
   );
}

export const requireEmptyCategoryTree = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fetchDescendantIds(context.db, id).andThen(
         (descendants) => {
            const allIds = [id, ...descendants];
            return fromPromise(
               context.db
                  .select({ count: sql<number>`count(*)::int` })
                  .from(transactions)
                  .where(inArray(transactions.categoryId, allIds))
                  .then((rows) => rows[0]?.count ?? 0),
               dbErr("Falha ao verificar lançamentos."),
            ).andThen((count) =>
               count > 0
                  ? err(
                       WebAppError.conflict(
                          "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
                       ),
                    )
                  : ok(undefined),
            );
         },
      );
      if (result.isErr()) throw result.error;
      return next();
   },
);

export const withExpandedCategoryIds = base.middleware(
   async ({ context, next }, ids: string[]) => {
      const result = await ResultAsync.combine(
         ids.map((id) => fetchDescendantIds(context.db, id)),
      ).map((lists) => [...new Set([...ids, ...lists.flat()])]);
      if (result.isErr()) throw result.error;
      return next({ context: { expandedCategoryIds: result.value } });
   },
);

export const requireNoTransactionsForExpandedIds = os
   .$context<ORPCContextWithOrganization & { expandedCategoryIds: string[] }>()
   .middleware(async ({ context, next }) => {
      const result = await fromPromise(
         context.db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(
               inArray(transactions.categoryId, context.expandedCategoryIds),
            )
            .then((rows) => rows[0]?.count ?? 0),
         dbErr("Falha ao verificar lançamentos."),
      ).andThen((count) =>
         count > 0
            ? errAsync(
                 WebAppError.conflict(
                    "Categorias com lançamentos não podem ser excluídas. Use arquivamento.",
                 ),
              )
            : okAsync(undefined),
      );
      if (result.isErr()) throw result.error;
      return next();
   });

export const withCategoryDescendants = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fetchDescendantIds(context.db, id);
      if (result.isErr()) throw result.error;
      return next({ context: { descendantCategoryIds: result.value } });
   },
);
