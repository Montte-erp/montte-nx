import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import type { PostHog } from "posthog-node";
import type { DatabaseInstance } from "@core/database/client";
import { organization, team, teamMember } from "@core/database/schemas/auth";
import { AppError } from "@core/logging/errors";
import { seedClassificationDefaults } from "@modules/classification/seeds";

const EARLY_ACCESS_FLAGS = ["contacts"];
const ONBOARDING_PRODUCTS = new Set<string>(["finance", "contacts"]);

export type OnboardingProduct = "finance" | "contacts";

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
   onboardingProducts: OnboardingProduct[];
}) {
   const { db, organizationId, teamId, userId, slug, onboardingProducts } =
      args;

   for (const product of onboardingProducts) {
      if (!ONBOARDING_PRODUCTS.has(product)) {
         throw AppError.validation("Produto de onboarding inválido.");
      }
   }

   await db.transaction(async (tx) => {
      await tx
         .insert(teamMember)
         .values({ teamId, userId, createdAt: dayjs().toDate() })
         .onConflictDoNothing();

      const seed = await seedClassificationDefaults(tx, teamId);
      if (seed.isErr()) throw seed.error;

      await tx
         .update(team)
         .set({
            slug,
            onboardingProducts,
            onboardingCompleted: true,
         })
         .where(eq(team.id, teamId));

      await tx
         .update(organization)
         .set({ onboardingCompleted: true })
         .where(eq(organization.id, organizationId));
   });
}
