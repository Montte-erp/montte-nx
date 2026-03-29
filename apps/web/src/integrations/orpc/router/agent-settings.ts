import {
   getAgentSettings,
   upsertAgentSettings,
} from "@core/database/repositories/agent-settings-repository";
import { agentSettings } from "@core/database/schemas/agents";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const agentSettingsSchema = createInsertSchema(agentSettings)
   .omit({ teamId: true, createdAt: true, updatedAt: true })
   .extend({
      modelId: z.string().startsWith("openrouter/").optional(),
   });

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   return getAgentSettings(context.db, context.teamId);
});

export const upsertSettings = protectedProcedure
   .input(agentSettingsSchema.partial())
   .handler(async ({ context, input }) => {
      return upsertAgentSettings(context.db, context.teamId, input);
   });
