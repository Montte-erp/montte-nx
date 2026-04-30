import { fromPromise } from "neverthrow";
import { z } from "zod";
import { generatePresignedPutUrl } from "@core/files/client";
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

export const generateAvatarUploadUrl = protectedProcedure
   .input(
      z.object({
         fileExtension: z
            .string()
            .regex(/^[a-zA-Z0-9]{1,10}$/, "Extensão de arquivo inválida."),
      }),
   )
   .handler(async ({ context, input }) => {
      const bucketName = "user-avatars";
      const fileName = `avatar-${context.userId}-${crypto.randomUUID()}.${input.fileExtension}`;
      const result = await fromPromise(
         generatePresignedPutUrl(
            context.minioClient,
            fileName,
            bucketName,
            300,
         ),
         () => WebAppError.internal("Erro ao gerar URL de upload."),
      );
      if (result.isErr()) throw result.error;
      return {
         presignedUrl: result.value,
         fileName,
         publicUrl: `/api/files/${bucketName}/${fileName}`,
      };
   });
