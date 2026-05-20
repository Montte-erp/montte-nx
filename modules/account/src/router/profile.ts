import { Result } from "better-result";
import { z } from "zod";
import { protectedProcedure } from "@core/orpc/server";
import {
   AccountError,
   accountErrors,
   getErrorField,
   toAuthError,
} from "@modules/account/router/errors";

export const verifyPassword = protectedProcedure
   .input(z.object({ password: z.string() }))
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.verifyPassword({
               headers: context.headers,
               body: { password: input.password },
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao verificar senha.",
               userId: context.userId,
            }),
      });
      return { valid: result.isOk() };
   });

export const hasPassword = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () =>
         context.auth.api.listUserAccounts({
            headers: context.headers,
         }),
      catch: (error) =>
         toAuthError(
            error,
            "Falha ao listar contas vinculadas.",
            "Permissões insuficientes.",
            "Falha ao listar contas vinculadas.",
         ),
   });
   if (result.isErr()) throw result.error;

   return {
      hasPassword: result.value.some((a) => a.providerId === "credential"),
   };
});

export const getLinkedAccounts = protectedProcedure.handler(
   async ({ context }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.listUserAccounts({
               headers: context.headers,
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Falha ao listar contas vinculadas.",
               "Permissões insuficientes.",
               "Falha ao listar contas vinculadas.",
            ),
      });
      if (result.isErr()) throw result.error;

      return result.value.map((a) => ({
         providerId: a.providerId,
         accountId: a.accountId,
         createdAt: a.createdAt,
      }));
   },
);

export const setPassword = protectedProcedure
   .input(z.object({ newPassword: z.string().min(8) }))
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.setPassword({
               headers: context.headers,
               body: { newPassword: input.newPassword },
            }),
         catch: (error) => {
            const message =
               getErrorField(error, "message") === "user already has a password"
                  ? "Usuário já possui uma senha definida."
                  : "Erro ao definir senha.";

            if (message === "Usuário já possui uma senha definida.") {
               return new AccountError({
                  error: accountErrors.BAD_REQUEST(),
                  message,
                  userId: context.userId,
               });
            }

            return toAuthError(
               error,
               message,
               "Permissões insuficientes.",
               "Erro ao definir senha.",
            );
         },
      });
      if (result.isErr()) throw result.error;
      return { success: true };
   });
