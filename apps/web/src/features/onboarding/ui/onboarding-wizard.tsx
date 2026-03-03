import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Spinner } from "@packages/ui/components/spinner";
import { defineStepper } from "@packages/ui/components/stepper";
import { useNavigate } from "@tanstack/react-router";
import {
   useCallback,
   useEffect,
   useMemo,
   useRef,
   useState,
   useTransition,
} from "react";
import type { Session } from "@/integrations/better-auth/auth-client";
import { type AccountType, AccountTypeStep } from "./account-type-step";
import { ProfileStep } from "./profile-step";
import type { StepHandle, StepState } from "./step-handle";
import { WorkspaceStep } from "./workspace-step";

type Organization = {
   id: string;
   name: string;
   slug: string;
   logo: string | null;
   role: string;
   onboardingCompleted: boolean | null;
};

interface OnboardingWizardProps {
   session: NonNullable<Session>;
   organizations: Organization[];
   activeOrg: Organization | null;
}

export function OnboardingWizard({
   session,
   organizations: _organizations,
   activeOrg,
}: OnboardingWizardProps) {
   const navigate = useNavigate();

   const needsProfile = !session.user.name;
   const needsWorkspace = !activeOrg;

   const steps = useMemo(() => {
      const s: { id: string; title: string }[] = [];
      if (needsProfile) s.push({ id: "profile", title: "Perfil" });
      if (needsWorkspace)
         s.push({ id: "account-type", title: "Tipo de Conta" });
      if (needsWorkspace) s.push({ id: "workspace", title: "Workspace" });
      return s;
   }, [needsProfile, needsWorkspace]);

   const { Stepper } = useMemo(() => defineStepper(...steps), [steps]);

   const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(
      activeOrg?.slug ?? null,
   );
   const [selectedAccountType, setSelectedAccountType] =
      useState<AccountType>("personal");

   const stepRef = useRef<StepHandle>(null);
   const [, startTransition] = useTransition();
   const [stepState, setStepState] = useState<StepState>({
      canContinue: true,
      isPending: false,
   });

   const handleStepStateChange = useCallback((state: StepState) => {
      setStepState(state);
   }, []);

   const handleProfileComplete = useCallback(
      (next: () => void) => {
         if (needsWorkspace) {
            next();
         } else if (activeOrg) {
            // Onboarding flags were already fixed by the route loader.
            // Navigate to the org and let the routing chain pick the active team.
            navigate({ to: "/$slug", params: { slug: activeOrg.slug } });
         }
      },
      [needsWorkspace, navigate, activeOrg],
   );

   const handleAccountTypeComplete = useCallback(
      (accountType: AccountType, next: () => void) => {
         setSelectedAccountType(accountType);
         next();
      },
      [],
   );

   const handleWorkspaceComplete = useCallback(
      ({ orgSlug, teamSlug }: { orgSlug: string; teamSlug: string }) => {
         navigate({
            to: "/$slug/$teamSlug/home",
            params: { slug: orgSlug, teamSlug },
         });
      },
      [navigate],
   );

   // If there's nothing to do, navigate away after render.
   useEffect(() => {
      if (steps.length === 0) {
         navigate({ to: "/" });
      }
   }, [steps.length, navigate]);

   if (steps.length === 0) {
      return null;
   }

   return (
      <Stepper.Provider
         className="mx-auto flex min-h-screen max-w-6xl flex-col"
         variant="line"
      >
         {({ methods }) => {
            const isFirstStep = methods.state.isFirst;
            const isLastStep = methods.state.isLast;

            const handleContinue = () => {
               startTransition(async () => {
                  await stepRef.current?.submit();
               });
            };

            const handleBack = () => {
               methods.navigation.prev();
            };

            return (
               <>
                  {/* Header: step indicators + logo */}
                  <header className="shrink-0 border-b p-4">
                     <div className="mx-auto flex w-full items-center gap-4">
                        <Stepper.Navigation className="flex-1">
                           {steps.map((step) => (
                              <Stepper.Step key={step.id} of={step.id} />
                           ))}
                        </Stepper.Navigation>
                        <div className="flex shrink-0 items-center gap-2">
                           <img
                              alt="Montte"
                              className="size-8 shrink-0 rounded-full"
                              src="/favicon.svg"
                           />
                           <Badge
                              className="bg-muted text-muted-foreground"
                              variant="outline"
                           >
                              app.montte.co
                              {workspaceSlug ? `/${workspaceSlug}` : ""}
                           </Badge>
                        </div>
                     </div>
                  </header>

                  {/* Main: step content */}
                  <main className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
                     <div
                        className="w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
                        key={methods.state.current.data.id}
                     >
                        {methods.flow.switch({
                           profile: () => (
                              <ProfileStep
                                 defaultName={session.user.name ?? ""}
                                 onNext={() =>
                                    handleProfileComplete(
                                       methods.navigation.next,
                                    )
                                 }
                                 onStateChange={handleStepStateChange}
                                 ref={stepRef}
                              />
                           ),
                           "account-type": () => (
                              <AccountTypeStep
                                 onNext={(accountType) =>
                                    handleAccountTypeComplete(
                                       accountType,
                                       methods.navigation.next,
                                    )
                                 }
                                 onStateChange={handleStepStateChange}
                                 ref={stepRef}
                              />
                           ),
                           workspace: () => (
                              <WorkspaceStep
                                 accountType={selectedAccountType}
                                 onNext={handleWorkspaceComplete}
                                 onSlugChange={setWorkspaceSlug}
                                 onStateChange={handleStepStateChange}
                                 ref={stepRef}
                              />
                           ),
                        })}
                     </div>
                  </main>

                  {/* Footer: back / continue */}
                  <footer className="shrink-0 px-4 py-4">
                     <div className="mx-auto flex w-full gap-3">
                        {!isFirstStep && (
                           <Button
                              className="h-11"
                              disabled={stepState.isPending}
                              onClick={handleBack}
                              type="button"
                              variant="outline"
                           >
                              Voltar
                           </Button>
                        )}
                        <Button
                           className="h-11 flex-1"
                           disabled={
                              stepState.isPending || !stepState.canContinue
                           }
                           onClick={handleContinue}
                           type="button"
                        >
                           {stepState.isPending ? (
                              <Spinner className="size-4" />
                           ) : isLastStep ? (
                              "Concluir"
                           ) : (
                              "Continuar"
                           )}
                        </Button>
                     </div>
                  </footer>
               </>
            );
         }}
      </Stepper.Provider>
   );
}
