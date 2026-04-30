import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import type { PostHog } from "posthog-node";
import type { DatabaseInstance } from "@core/database/client";
import { organization, team, teamMember } from "@core/database/schemas/auth";
import { seedClassificationDefaults } from "@modules/classification/seeds";

const EARLY_ACCESS_FLAGS = ["contacts", "services", "advanced-analytics"];

export function enrollInAllFeatures(
   posthog: PostHog,
   userId: string,
   organizationId: string,
) {
   for (const flagKey of EARLY_ACCESS_FLAGS) {
      posthog.capture({
         distinctId: userId,
         event: "$feature_enrollment_update",
         properties: {
            $feature_flag: flagKey,
            $feature_enrollment: true,
            $set: { [`$feature_enrollment/${flagKey}`]: true },
         },
         groups: { organization: organizationId },
      });
   }
}

export async function runOnboardingCompletion(args: {
   db: DatabaseInstance;
   organizationId: string;
   teamId: string;
   userId: string;
   slug: string;
}) {
   const { db, organizationId, teamId, userId, slug } = args;

   await db.transaction(async (tx) => {
      await tx
         .insert(teamMember)
         .values({ teamId, userId, createdAt: dayjs().toDate() });

      const seed = await seedClassificationDefaults(tx, teamId);
      if (seed.isErr()) throw seed.error;

      await tx
         .update(team)
         .set({
            slug,
            onboardingProducts: ["finance"],
            onboardingCompleted: true,
         })
         .where(eq(team.id, teamId));

      await tx
         .update(organization)
         .set({ onboardingCompleted: true })
         .where(eq(organization.id, organizationId));
   });

   // TODO(MON-566 / modules/insights): seed default insights + dashboard.
   // Lives outside account scope — analytics module owns dashboard/insight seeds.
}
