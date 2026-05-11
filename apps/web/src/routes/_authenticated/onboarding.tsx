import {
   createFileRoute,
   redirect,
   type ErrorComponentProps,
} from "@tanstack/react-router";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { Button } from "@packages/ui/components/button";
import { OnboardingWizard } from "./-onboarding/onboarding-wizard";

const onboardingStepSchema = z
   .enum(["profile", "features", "company"])
   .catch("features")
   .default("features");

const onboardingFeatureSchema = z.enum(["finance", "contacts", "services"]);

const onboardingFeaturesSchema = z
   .array(onboardingFeatureSchema)
   .catch([])
   .default([]);

export const Route = createFileRoute("/_authenticated/onboarding")({
   validateSearch: z.object({
      new: z.boolean().catch(false).default(false),
      step: onboardingStepSchema,
      features: onboardingFeaturesSchema,
   }),
   beforeLoad: async ({ context, search }) => {
      const sessionResult = await fromPromise(
         context.queryClient.fetchQuery(
            context.orpc.session.getSession.queryOptions({}),
         ),
         () => null,
      );

      if (sessionResult.isErr() || !sessionResult.value?.user?.id) {
         throw redirect({
            search: { redirect: undefined },
            to: "/auth/sign-in",
         });
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
               search: { ...search, step: "features" },
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
               to: "/$slug/$teamSlug/inbox",
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
            search: { ...search, step: "features" },
         });
      }

      return {
         session,
         organizations,
         activeOrg: activeOrg ?? null,
      };
   },
   head: () => ({
      meta: [{ title: "Onboarding — Montte" }],
   }),
   errorComponent: OnboardingErrorComponent,
   component: OnboardingPage,
});

function OnboardingErrorComponent({ reset }: ErrorComponentProps) {
   return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
         <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold">
               Falha ao carregar onboarding
            </h1>
            <p className="text-sm text-muted-foreground">
               Tente novamente para continuar a configuração.
            </p>
         </div>
         <Button onClick={reset} variant="outline">
            Tentar novamente
         </Button>
      </div>
   );
}

function OnboardingPage() {
   const { session, organizations, activeOrg } = Route.useRouteContext();
   const navigate = Route.useNavigate();
   const search = Route.useSearch();

   return (
      <OnboardingWizard
         activeOrg={activeOrg}
         features={search.features}
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
