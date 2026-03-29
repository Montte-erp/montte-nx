import {
   getContactSettings,
   upsertContactSettings,
} from "@core/database/repositories/contact-settings-repository";
import { contactSettings } from "@core/database/schemas/contact-settings";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const contactSettingsSchema = createInsertSchema(contactSettings)
   .omit({
      teamId: true,
      createdAt: true,
      updatedAt: true,
   })
   .extend({
      defaultContactType: z.enum(["pf", "pj"]),
   })
   .partial();

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   return getContactSettings(context.db, context.teamId);
});

export const upsertSettings = protectedProcedure
   .input(contactSettingsSchema)
   .handler(async ({ context, input }) => {
      return upsertContactSettings(context.db, context.teamId, input);
   });
