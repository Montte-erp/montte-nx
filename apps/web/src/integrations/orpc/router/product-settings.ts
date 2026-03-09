import { ORPCError } from "@orpc/server";
import {
   getProductSettings,
   updateAiDefaults as updateAiDefaultsRepo,
} from "@core/database/repositories/product-settings-repository";
import { AIDefaultsSchema } from "@core/database/schemas/product-settings";
import { protectedProcedure } from "../server";

// =============================================================================
// Procedures
// =============================================================================

/**
 * Get product settings for the current team.
 * Returns null if no settings exist yet.
 */
export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;

   try {
      return await getProductSettings(db, teamId);
   } catch (err) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
         message:
            err instanceof Error
               ? err.message
               : "Failed to get product settings",
      });
   }
});

/**
 * Update AI defaults for the current team.
 * Merges new data with existing aiDefaults if settings exist.
 */
export const updateAiDefaults = protectedProcedure
   .input(AIDefaultsSchema.partial())
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      try {
         return await updateAiDefaultsRepo(db, teamId, input);
      } catch (err) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message:
               err instanceof Error
                  ? err.message
                  : "Failed to update AI defaults",
         });
      }
   });
