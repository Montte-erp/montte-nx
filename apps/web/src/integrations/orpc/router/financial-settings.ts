import {
   getFinancialSettings,
   upsertFinancialSettings,
} from "@core/database/repositories/financial-settings-repository";
import { financialSettings } from "@core/database/schemas/financial";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const financialSettingsSchema = createInsertSchema(financialSettings)
   .omit({ teamId: true, createdAt: true, updatedAt: true })
   .extend({
      fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
   });

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   return getFinancialSettings(context.db, context.teamId);
});

export const upsertSettings = protectedProcedure
   .input(financialSettingsSchema.partial())
   .handler(async ({ context, input }) => {
      return upsertFinancialSettings(context.db, context.teamId, input);
   });
