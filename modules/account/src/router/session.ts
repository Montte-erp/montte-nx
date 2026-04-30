import { fromPromise } from "neverthrow";
import { z } from "zod";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure, publicProcedure } from "@core/orpc/server";

export const getSession = publicProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.auth.api.getSession({ headers: context.headers }),
      (e) => WebAppError.internal("Falha ao recuperar sessão.", { cause: e }),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const listSessions = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.auth.api.listSessions({ headers: context.headers }),
      (e) => WebAppError.internal("Falha ao listar sessões.", { cause: e }),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const revokeSessionByToken = protectedProcedure
   .input(z.object({ token: z.string() }))
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.auth.api.revokeSession({
            headers: context.headers,
            body: { token: input.token },
         }),
         (e) => WebAppError.internal("Falha ao revogar sessão.", { cause: e }),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });

export const revokeOtherSessions = protectedProcedure.handler(
   async ({ context }) => {
      const result = await fromPromise(
         context.auth.api.revokeOtherSessions({ headers: context.headers }),
         (e) =>
            WebAppError.internal("Falha ao revogar outras sessões.", {
               cause: e,
            }),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   },
);

export const revokeSessions = protectedProcedure.handler(
   async ({ context }) => {
      const result = await fromPromise(
         context.auth.api.revokeSessions({ headers: context.headers }),
         (e) =>
            WebAppError.internal("Falha ao revogar todas as sessões.", {
               cause: e,
            }),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   },
);
