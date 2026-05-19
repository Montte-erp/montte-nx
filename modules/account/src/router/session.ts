import { Result } from "better-result";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "@core/orpc/server";
import {
   AccountError,
   accountErrors,
   toAuthError,
} from "@modules/account/router/errors";

export const getSession = publicProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () => context.auth.api.getSession({ headers: context.headers }),
      catch: (error) =>
         toAuthError(
            error,
            "Falha ao recuperar sessão.",
            "Permissões insuficientes.",
            "Falha ao recuperar sessão.",
         ),
   });
   if (result.isErr()) throw result.error;
   return result.value;
});

export const listSessions = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () => context.auth.api.listSessions({ headers: context.headers }),
      catch: (error) =>
         toAuthError(
            error,
            "Falha ao listar sessões.",
            "Permissões insuficientes.",
            "Falha ao listar sessões.",
         ),
   });
   if (result.isErr()) throw result.error;
   return result.value;
});

export const revokeSessionByToken = protectedProcedure
   .input(z.object({ token: z.string() }))
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.revokeSession({
               headers: context.headers,
               body: { token: input.token },
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao revogar sessão.",
               userId: context.userId,
               token: input.token,
            }),
      });
      if (result.isErr()) throw result.error;
      return { success: true };
   });

export const revokeOtherSessions = protectedProcedure.handler(
   async ({ context }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.revokeOtherSessions({ headers: context.headers }),
         catch: (error) =>
            toAuthError(
               error,
               "Falha ao revogar outras sessões.",
               "Permissões insuficientes.",
               "Falha ao revogar outras sessões.",
            ),
      });
      if (result.isErr()) throw result.error;
      return { success: true };
   },
);

export const revokeSessions = protectedProcedure.handler(
   async ({ context }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.revokeSessions({ headers: context.headers }),
         catch: (error) =>
            toAuthError(
               error,
               "Falha ao revogar todas as sessões.",
               "Permissões insuficientes.",
               "Falha ao revogar todas as sessões.",
            ),
      });
      if (result.isErr()) throw result.error;
      return { success: true };
   },
);
