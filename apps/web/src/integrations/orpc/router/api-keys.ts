import { protectedProcedure } from "../server";

export const list = protectedProcedure.handler(async ({ context }) => {
   const result = await context.auth.api.listApiKeys({
      headers: context.headers,
   });
   return result.apiKeys.filter((k) => k.metadata?.teamId === context.teamId);
});
