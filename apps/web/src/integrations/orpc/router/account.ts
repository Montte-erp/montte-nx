import { generatePresignedPutUrl } from "@core/files/client";
import { minioClient } from "@/integrations/singletons";
import { WebAppError } from "@core/logging";
import { getLogger } from "@core/logging";
import { z } from "zod";
import { protectedProcedure } from "../server";

const logger = getLogger().child({ module: "router:account" });

export const verifyPassword = protectedProcedure
   .input(z.object({ password: z.string() }))
   .handler(async ({ context, input }) => {
      const { auth, headers } = context;

      try {
         await auth.api.verifyPassword({
            headers,
            body: { password: input.password },
         });
         return { valid: true };
      } catch {
         return { valid: false };
      }
   });

export const hasPassword = protectedProcedure.handler(async ({ context }) => {
   const { auth, headers } = context;

   try {
      const accounts = await auth.api.listUserAccounts({ headers });
      const hasCredential = accounts.some(
         (account: { providerId: string }) =>
            account.providerId === "credential",
      );
      return { hasPassword: hasCredential };
   } catch {
      return { hasPassword: false };
   }
});

export const getLinkedAccounts = protectedProcedure.handler(
   async ({ context }) => {
      const { auth, headers } = context;

      try {
         const accounts = await auth.api.listUserAccounts({ headers });
         return accounts.map(
            (account: {
               providerId: string;
               accountId: string;
               createdAt: Date;
            }) => ({
               providerId: account.providerId,
               accountId: account.accountId,
               createdAt: account.createdAt,
            }),
         );
      } catch {
         return [];
      }
   },
);

export const setPassword = protectedProcedure
   .input(z.object({ newPassword: z.string().min(8) }))
   .handler(async ({ context, input }) => {
      const { auth, headers } = context;

      try {
         await auth.api.setPassword({
            headers,
            body: { newPassword: input.newPassword },
         });
         return { success: true };
      } catch (error) {
         if (error && typeof error === "object" && "message" in error) {
            const msg = (error as { message: string }).message;
            if (msg === "user already has a password") {
               throw new WebAppError("BAD_REQUEST", {
                  message: "Usuário já possui uma senha definida",
               });
            }
         }
         throw new WebAppError("INTERNAL_SERVER_ERROR", {
            message: "Erro ao definir senha",
         });
      }
   });

export const generateAvatarUploadUrl = protectedProcedure
   .input(
      z.object({
         fileExtension: z
            .string()
            .regex(/^[a-zA-Z0-9]{1,10}$/, "Invalid file extension"),
      }),
   )
   .handler(async ({ context, input }) => {
      const { userId } = context;

      try {
         const bucketName = "user-avatars";
         const fileName = `avatar-${userId}-${crypto.randomUUID()}.${input.fileExtension}`;

         const presignedUrl = await generatePresignedPutUrl(
            minioClient,
            fileName,
            bucketName,
            300,
         );

         return {
            presignedUrl,
            fileName,
            publicUrl: `/api/files/${bucketName}/${fileName}`,
         };
      } catch (error) {
         logger.error({ err: error }, "Failed to generate avatar upload URL");
         throw new WebAppError("INTERNAL_SERVER_ERROR", {
            message: "Erro ao gerar URL de upload",
         });
      }
   });
