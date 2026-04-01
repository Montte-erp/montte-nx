import {
   getOrganizacaoModulos,
   getOrganizacaoRotuloConfig,
   updateOrganizacaoModulo,
} from "@core/database/repositories/organization-config-repository";
import { moduloEnum } from "@core/database/schemas/organization-config";
import { z } from "zod";
import { protectedProcedure } from "../server";

export const getModules = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return await getOrganizacaoModulos(db, teamId);
});

export const updateModule = protectedProcedure
   .input(
      z.object({
         modulo: z.enum(moduloEnum.enumValues),
         habilitado: z.boolean(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      await updateOrganizacaoModulo(db, teamId, input.modulo, input.habilitado);
      return { success: true };
   });

export const getRotuloConfig = protectedProcedure.handler(
   async ({ context }) => {
      const { db, teamId } = context;
      return await getOrganizacaoRotuloConfig(db, teamId);
   },
);
