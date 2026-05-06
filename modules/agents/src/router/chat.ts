import { protectedProcedure } from "@core/orpc/server";

export const ping = protectedProcedure.handler(async ({ context }) => ({
   ok: true,
   teamId: context.teamId,
}));
