import { protectedProcedure } from "../server";

const FLAG_KEYS = new Set([
   "contacts",
   "inventory",
   "services",
   "advanced-analytics",
   "data-management",
]);

export const getEnrolledFeatures = protectedProcedure.handler(
   async ({ context }) => {
      try {
         if (!context.posthog) {
            return { enrolled: [] as string[] };
         }

         const allFlags = await context.posthog.getAllFlags(context.userId, {
            groups: { organization: context.organizationId },
         });

         const enrolled: string[] = [];
         for (const [key, value] of Object.entries(allFlags)) {
            if (FLAG_KEYS.has(key) && Boolean(value)) {
               enrolled.push(key);
            }
         }

         return { enrolled };
      } catch {
         return { enrolled: [] as string[] };
      }
   },
);
