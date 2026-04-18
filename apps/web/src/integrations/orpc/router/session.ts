import { WebAppError } from "@core/logging";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../server";

export const getSession = publicProcedure.handler(async ({ context }) => {
   const { auth, headers } = context;

   try {
      return await auth.api.getSession({ headers });
   } catch (error) {
      throw WebAppError.internal("Falha ao recuperar sessão.", {
         cause: error,
      });
   }
});

export const listSessions = protectedProcedure.handler(async ({ context }) => {
   const { auth, headers } = context;

   try {
      return await auth.api.listSessions({ headers });
   } catch (error) {
      throw WebAppError.internal("Falha ao listar sessões.", { cause: error });
   }
});

export const revokeSessionByToken = protectedProcedure
   .input(z.object({ token: z.string() }))
   .handler(async ({ context, input }) => {
      const { auth, headers } = context;

      try {
         await auth.api.revokeSession({
            headers,
            body: { token: input.token },
         });

         return { success: true };
      } catch (error) {
         throw WebAppError.internal("Falha ao revogar sessão.", {
            cause: error,
         });
      }
   });

export const revokeOtherSessions = protectedProcedure.handler(
   async ({ context }) => {
      const { auth, headers } = context;

      try {
         await auth.api.revokeOtherSessions({ headers });

         return { success: true };
      } catch (error) {
         throw WebAppError.internal("Falha ao revogar outras sessões.", {
            cause: error,
         });
      }
   },
);

export const revokeSessions = protectedProcedure.handler(
   async ({ context }) => {
      const { auth, headers } = context;

      try {
         await auth.api.revokeSessions({ headers });

         return { success: true };
      } catch (error) {
         throw WebAppError.internal("Falha ao revogar todas as sessões.", {
            cause: error,
         });
      }
   },
);
