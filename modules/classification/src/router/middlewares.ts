import { os } from "@orpc/server";
import { err, fromPromise, ok } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

export const requireCategory = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.categories.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
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
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((tag) =>
         !tag || tag.teamId !== context.teamId
            ? err(WebAppError.notFound("Centro de custo não encontrado."))
            : ok(tag),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { tag: result.value } });
   },
);
