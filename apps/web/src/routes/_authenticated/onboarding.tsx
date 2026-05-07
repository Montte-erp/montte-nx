import { createFileRoute, redirect } from "@tanstack/react-router";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { OnboardingWizard } from "./-onboarding/onboarding-wizard";

const onboardingStepSchema = z
   .enum(["profile", "goal", "company"])
   .catch("goal")
   .default("goal");

const onboardingGoalSchema = z
   .enum(["finance", "clients_services", "pick_myself"])
   .nullable()
   .catch(null)
   .default(null);

export const Route = createFileRoute("/_authenticated/onboarding")({
   validateSearch: z.object({
      new: z.boolean().catch(false).default(false),
      step: onboardingStepSchema,
      goal: onboardingGoalSchema,
   }),
   beforeLoad: async ({ context, search }) => {
      const sessionResult = await fromPromise(
         context.queryClient.fetchQuery(
            context.orpc.session.getSession.queryOptions({}),
         ),
         () => null,
      );

      if (sessionResult.isErr() || !sessionResult.value?.user?.id) {
         throw redirect({ to: "/auth/sign-in" });
      }

      const session = sessionResult.value;

      const organizations = await context.queryClient.fetchQuery(
         context.orpc.organization.getOrganizations.queryOptions(),
      );

      if (search.new) {
         if (!session.user.name && search.step !== "profile") {
            throw redirect({
               to: "/onboarding",
               search: { ...search, step: "profile" },
            });
         }

         if (session.user.name && search.step === "profile") {
            throw redirect({
               to: "/onboarding",
               search: { ...search, step: "goal" },
            });
         }

         if (search.step === "company" && !search.goal) {
            throw redirect({
               to: "/onboarding",
               search: { ...search, step: "goal" },
            });
         }

         return { session, organizations, activeOrg: null };
      }

      const activeOrg =
         organizations.find(
            (org) => org.id === session.session.activeOrganizationId,
         ) ?? organizations[0];

      if (activeOrg) {
         const fixedResult = await fromPromise(
            context.queryClient.fetchQuery(
               context.orpc.onboarding.fixOnboarding.queryOptions({
                  input: { organizationId: activeOrg.id },
               }),
            ),
            () => null,
         );

         if (fixedResult.isOk() && fixedResult.value && session.user.name) {
            throw redirect({
               to: "/$slug/$teamSlug/home",
               params: {
                  slug: fixedResult.value.orgSlug,
                  teamSlug: fixedResult.value.teamSlug,
               },
            });
         }
      }

      if (!session.user.name && search.step !== "profile") {
         throw redirect({
            to: "/onboarding",
            search: { ...search, step: "profile" },
         });
      }

      if (!activeOrg && session.user.name && search.step === "profile") {
         throw redirect({
            to: "/onboarding",
            search: { ...search, step: "goal" },
         });
      }

      if (!activeOrg && search.step === "company" && !search.goal) {
         throw redirect({
            to: "/onboarding",
            search: { ...search, step: "goal" },
         });
      }

      return {
         session,
         organizations,
         activeOrg: activeOrg ?? null,
      };
   },
   component: OnboardingPage,
});

function OnboardingPage() {
   const { session, organizations, activeOrg } = Route.useRouteContext();
   const navigate = Route.useNavigate();
   const search = Route.useSearch();

   return (
      <OnboardingWizard
         activeOrg={activeOrg}
         goal={search.goal}
         isNewOrganization={search.new}
         navigateSearch={(nextSearch) =>
            navigate({
               search: (prev) => ({ ...prev, ...nextSearch }),
               replace: true,
            })
         }
         organizations={organizations}
         session={session}
         step={search.step}
      />
   );
}
