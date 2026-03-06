import { protectedProcedure } from "../server";
import { posthog } from "../server-instances";

const FLAG_KEYS = new Set([
   "contacts",
   "inventory",
   "services",
   "advanced-analytics",
   "data-management",
]);

/**
 * Returns the set of early access feature flag keys the current user is enrolled in.
 * Uses posthog-node's getAllFlags — without a personalApiKey configured,
 * it skips local evaluation and calls /flags/?v=2 remotely, which has
 * access to $feature_enrollment person properties.
 */
export const getEnrolledFeatures = protectedProcedure.handler(
   async ({ context }) => {
      try {
         const allFlags = await posthog.getAllFlags(context.userId, {
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
