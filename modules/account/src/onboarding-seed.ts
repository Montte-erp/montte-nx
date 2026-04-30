import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import type { PostHog } from "posthog-node";
import type { DatabaseInstance } from "@core/database/client";
import { organization, team, teamMember } from "@core/database/schemas/auth";
import { insights } from "@core/database/schemas/insights";
import { getInsightById } from "@core/database/repositories/insight-repository";
import { getLogger } from "@core/logging/root";
import { seedClassificationDefaults } from "@modules/classification/seeds";
import { computeInsightData } from "@packages/analytics/compute-insight";
import {
   createDefaultDashboard,
   createDefaultInsights,
} from "@packages/analytics/seed-defaults";

const logger = getLogger().child({ module: "account:onboarding-seed" });

const EARLY_ACCESS_FLAGS = [
   "contacts",
   "inventory",
   "services",
   "advanced-analytics",
];

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
   workspaceName: string;
   slug: string;
}) {
   const { db, organizationId, teamId, userId, workspaceName, slug } = args;

   await db
      .insert(teamMember)
      .values({ teamId, userId, createdAt: dayjs().toDate() });

   const seed = await seedClassificationDefaults(db, teamId);
   if (seed.isErr()) throw seed.error;

   await db
      .update(team)
      .set({
         slug,
         onboardingProducts: ["finance"],
         onboardingCompleted: true,
      })
      .where(eq(team.id, teamId));

   await db
      .update(organization)
      .set({ onboardingCompleted: true })
      .where(eq(organization.id, organizationId));

   const insightIds = await createDefaultInsights(
      db,
      organizationId,
      teamId,
      userId,
   );

   for (const insightId of insightIds) {
      const computed = await fromPromise(
         (async () => {
            const insight = await getInsightById(db, insightId);
            if (!insight) return;
            const data = await computeInsightData(db, insight);
            await db
               .update(insights)
               .set({ cachedResults: data, lastComputedAt: dayjs().toDate() })
               .where(eq(insights.id, insightId));
         })(),
         (e) => e,
      );
      if (computed.isErr())
         logger.error(
            { err: computed.error, insightId },
            "Insight compute failed",
         );
   }

   await createDefaultDashboard(
      db,
      organizationId,
      teamId,
      userId,
      `Dashboard ${workspaceName}`,
      insightIds,
   );
}
