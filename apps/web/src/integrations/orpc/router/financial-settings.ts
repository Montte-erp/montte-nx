import {
   getFinancialConfig,
   upsertFinancialConfig,
} from "@core/database/repositories/financial-settings-repository";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

const updateSchema = z.object({
   costCenterRequired: z.boolean(),
});

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   return (await getFinancialConfig(context.db, context.teamId)).match(
      (config) => config,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   );
});

export const upsertSettings = protectedProcedure
   .input(updateSchema)
   .handler(async ({ context, input }) => {
      return (
         await upsertFinancialConfig(context.db, context.teamId, input)
      ).match(
         (config) => config,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });
