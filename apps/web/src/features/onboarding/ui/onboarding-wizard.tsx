import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Spinner } from "@packages/ui/components/spinner";
import { defineStepper } from "@packages/ui/components/stepper";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { Session } from "@/integrations/better-auth/auth-client";
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
      if (needsWorkspace) s.push({ id: "workspace", title: "Workspace" });
      return s;
   }, [needsProfile, needsWorkspace]);

   if (steps.length === 0) {
      navigate({ to: "/" });
      return null;
   }

   const { Stepper } = useMemo(() => defineStepper(...steps), [steps]);

   const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(
      activeOrg?.slug ?? null,
   );

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
      (methods: { navigation: { next: () => void } }) => {
         if (needsWorkspace) {
            methods.navigation.next();
         }
      },
      [needsWorkspace],
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
                  {/* Header: stepper + logo */}
                  <header className="shrink-0 border-b p-4">
                     <div className="mx-auto flex w-full  items-center gap-4">
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

                  {/* Main: step content centered */}
                  <main className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
                     <div
                        className="w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
                        key={methods.state.current.data.id}
                     >
                        {methods.flow.switch({
                           ...(needsProfile
                              ? {
                                   profile: () => (
                                      <ProfileStep
                                         defaultName={session.user.name ?? ""}
                                         onNext={() =>
                                            handleProfileComplete(methods)
                                         }
                                         onStateChange={handleStepStateChange}
                                         ref={stepRef}
                                      />
                                   ),
                                }
                              : {}),
                           ...(needsWorkspace
                              ? {
                                   workspace: () => (
                                      <WorkspaceStep
                                         onNext={handleWorkspaceComplete}
                                         onSlugChange={setWorkspaceSlug}
                                         onStateChange={handleStepStateChange}
                                         ref={stepRef}
                                      />
                                   ),
                                }
                              : {}),
                        })}
                     </div>
                  </main>

                  {/* Footer: back/continue buttons */}
                  <footer className="shrink-0 border-t px-4 py-4">
                     <div className="mx-auto flex w-full  gap-3">
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
