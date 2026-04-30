import { os } from "@orpc/server";
import { err, fromPromise, ok } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

export const requireThread = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.threads.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar conversa."),
      ).andThen((thread) =>
         !thread || thread.teamId !== context.teamId
            ? err(WebAppError.notFound("Conversa não encontrada."))
            : ok(thread),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { thread: result.value } });
   },
);
