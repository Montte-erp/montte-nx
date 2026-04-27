import { fromPromise } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";

export const getEventCatalog = protectedProcedure.handler(
   async ({ context }) => {
      const result = await fromPromise(
         context.db.query.eventCatalog.findMany({
            orderBy: (t, { asc }) => [asc(t.category), asc(t.displayName)],
         }),
         () => WebAppError.internal("Falha ao buscar catálogo de eventos."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   },
);
