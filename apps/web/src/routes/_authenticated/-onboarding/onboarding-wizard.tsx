import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Spinner } from "@packages/ui/components/spinner";
import { defineStepper } from "@packages/ui/components/stepper";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
   useCallback,
   useEffect,
   useMemo,
   useRef,
   useState,
   useTransition,
} from "react";
import { toast } from "sonner";
import {
   authClient,
   type Session,
} from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import type { Inputs } from "@/integrations/orpc/client";
import { CnpjStep } from "./cnpj-step";

type CnpjData = NonNullable<
   Inputs["onboarding"]["createWorkspace"]["cnpjData"]
>;
import { ProfileStep } from "./profile-step";
import type { StepHandle, StepState } from "./step-handle";

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
      if (needsWorkspace) s.push({ id: "cnpj", title: "Empresa" });
      return s;
   }, [needsProfile, needsWorkspace]);

   const { Stepper } = useMemo(() => defineStepper(...steps), [steps]);

   const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);

   const stepRef = useRef<StepHandle>(null);
   const [, startTransition] = useTransition();
   const [stepState, setStepState] = useState<StepState>({
      canContinue: true,
      isPending: false,
   });

   const createWorkspace = useMutation(
      orpc.onboarding.createWorkspace.mutationOptions(),
   );

   const handleStepStateChange = useCallback((state: StepState) => {
      setStepState(state);
   }, []);

   const handleProfileComplete = useCallback(
      (next: () => void) => {
         if (needsWorkspace) {
            next();
         } else if (activeOrg) {
            navigate({ to: "/$slug", params: { slug: activeOrg.slug } });
         }
      },
      [needsWorkspace, navigate, activeOrg],
   );

   const handleCnpjComplete = useCallback(
      async ({
         workspaceName,
         cnpjData: data,
      }: {
         workspaceName: string;
         cnpjData: CnpjData | null;
      }) => {
         setCnpjData(data);

         try {
            const result = await createWorkspace.mutateAsync({
               workspaceName,
               cnpj: data?.cnpj,
               cnpjData: data,
            });

            await authClient.organization.setActive({
               organizationId: result.orgId,
            });

            await authClient.organization.setActiveTeam({
               teamId: result.teamId,
            });

            navigate({
               to: "/$slug/$teamSlug/home",
               params: { slug: result.orgSlug, teamSlug: result.teamSlug },
            });
         } catch (error) {
            toast.error(
               error instanceof Error ? error.message : "Erro ao criar espaço.",
            );
         }
      },
      [createWorkspace, navigate],
   );

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
            const isCreating = createWorkspace.isPending;

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
                              {cnpjData
                                 ? `/${(cnpjData.nome_fantasia || cnpjData.razao_social).toLowerCase().replace(/\s+/g, "-").slice(0, 20)}`
                                 : ""}
                           </Badge>
                        </div>
                     </div>
                  </header>

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
                           cnpj: () => (
                              <CnpjStep
                                 onNext={handleCnpjComplete}
                                 onStateChange={handleStepStateChange}
                                 ref={stepRef}
                              />
                           ),
                        })}
                     </div>
                  </main>

                  <footer className="shrink-0 px-4 py-4">
                     <div className="mx-auto flex w-full gap-3">
                        {!isFirstStep && (
                           <Button
                              className="h-11"
                              disabled={stepState.isPending || isCreating}
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
                              stepState.isPending ||
                              !stepState.canContinue ||
                              isCreating
                           }
                           onClick={handleContinue}
                           type="button"
                        >
                           {stepState.isPending || isCreating ? (
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
