import { z } from "zod";
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
 * Uses posthog-node's getAllFlags which does remote evaluation via PostHog's
 * /decide endpoint — this has access to $feature_enrollment person properties
 * (unlike local evaluation which doesn't).
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

/**
 * Server-side enrollment update for early access features.
 * Mirrors posthog-js's updateEarlyAccessFeatureEnrollment: captures a
 * $feature_enrollment_update event with $set to persist the person property.
 * Flushes to ensure the event reaches PostHog before responding.
 */
export const updateEnrollment = protectedProcedure
   .input(
      z.object({
         flagKey: z.string(),
         isEnrolled: z.boolean(),
      }),
   )
   .handler(async ({ context, input }) => {
      posthog.capture({
         distinctId: context.userId,
         event: "$feature_enrollment_update",
         properties: {
            $feature_flag: input.flagKey,
            $feature_enrollment: input.isEnrolled,
            $set: {
               [`$feature_enrollment/${input.flagKey}`]: input.isEnrolled,
            },
         },
      });

      await posthog.flush();

      return { success: true };
   });
