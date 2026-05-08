import { fromPromise } from "neverthrow";
import { z } from "zod";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";

const errMessage = (e: unknown): string =>
   e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : "";

export const verifyPassword = protectedProcedure
   .input(z.object({ password: z.string() }))
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.auth.api.verifyPassword({
            headers: context.headers,
            body: { password: input.password },
         }),
         () => undefined,
      );
      return { valid: result.isOk() };
   });

export const hasPassword = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.auth.api.listUserAccounts({ headers: context.headers }),
      () => WebAppError.internal("Falha ao listar contas vinculadas."),
   );
   if (result.isErr()) throw result.error;
   return {
      hasPassword: result.value.some((a) => a.providerId === "credential"),
   };
});

export const getLinkedAccounts = protectedProcedure.handler(
   async ({ context }) => {
      const result = await fromPromise(
         context.auth.api.listUserAccounts({ headers: context.headers }),
         () => WebAppError.internal("Falha ao listar contas vinculadas."),
      );
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
      const result = await fromPromise(
         context.auth.api.setPassword({
            headers: context.headers,
            body: { newPassword: input.newPassword },
         }),
         (e) =>
            errMessage(e) === "user already has a password"
               ? WebAppError.badRequest("Usuário já possui uma senha definida.")
               : WebAppError.internal("Erro ao definir senha."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });
