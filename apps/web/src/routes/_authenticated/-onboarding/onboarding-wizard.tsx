import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { fromPromise } from "neverthrow";
import posthog from "posthog-js";
import { Banknote, Check, MousePointer2, UsersRound } from "lucide-react";
import { type FormEvent, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
   authClient,
   type Session,
} from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const ONBOARDING_VERSION = "2026-05";

type OnboardingStep = "profile" | "goal" | "company";
type OnboardingGoal = "finance" | "clients_services" | "pick_myself";

type Organization = {
   id: string;
   name: string;
   slug: string;
   logo: string | null;
   role: string;
   onboardingCompleted: boolean | null;
};

type StepItem = {
   id: OnboardingStep;
   title: string;
};

type NavigateSearch = (search: {
   step?: OnboardingStep;
   goal?: OnboardingGoal | null;
   new?: boolean;
}) => void | Promise<void>;

interface OnboardingWizardProps {
   session: NonNullable<Session>;
   organizations: Organization[];
   activeOrg: Organization | null;
   step: OnboardingStep;
   goal: OnboardingGoal | null;
   isNewOrganization: boolean;
   navigateSearch: NavigateSearch;
}

const GOAL_OPTIONS: {
   id: OnboardingGoal;
   title: string;
   description: string;
   Icon: typeof Banknote;
}[] = [
   {
      id: "finance",
      title: "Organizar meu financeiro",
      description: "Controle contas, cartões, categorias e transações.",
      Icon: Banknote,
   },
   {
      id: "clients_services",
      title: "Gerenciar clientes e serviços",
      description: "Centralize contatos, serviços, benefícios e cobranças.",
      Icon: UsersRound,
   },
   {
      id: "pick_myself",
      title: "Vou escolher sozinho",
      description: "Crie seu espaço sem personalização inicial.",
      Icon: MousePointer2,
   },
];

const profileSchema = z.object({
   userName: z.string().min(2, "O nome deve ter no mínimo 2 caracteres."),
});

const companySchema = z.object({
   workspaceName: z.string().min(2, "O nome deve ter no mínimo 2 caracteres."),
});

export function OnboardingWizard({
   session,
   organizations,
   activeOrg,
   step,
   goal,
   isNewOrganization,
   navigateSearch,
}: OnboardingWizardProps) {
   const navigate = useNavigate();
   const createWorkspace = useMutation(
      orpc.onboarding.createWorkspace.mutationOptions(),
   );

   const steps = useMemo<StepItem[]>(() => {
      if (!activeOrg && !session.user.name) {
         return [
            { id: "profile", title: "Perfil" },
            { id: "goal", title: "Objetivo" },
            { id: "company", title: "Empresa" },
         ];
      }

      if (!activeOrg) {
         return [
            { id: "goal", title: "Objetivo" },
            { id: "company", title: "Empresa" },
         ];
      }

      return [{ id: "profile", title: "Perfil" }];
   }, [activeOrg, session.user.name]);

   const currentIndex = Math.max(
      steps.findIndex((item) => item.id === step),
      0,
   );
   const isMultiOrgCreation = isNewOrganization || organizations.length > 0;

   const handleProfileComplete = useCallback(() => {
      if (!activeOrg) {
         void navigateSearch({ step: "goal" });
         return;
      }

      navigate({ to: "/$slug", params: { slug: activeOrg.slug } });
   }, [activeOrg, navigate, navigateSearch]);

   const handleCreateWorkspace = useCallback(
      async (workspaceName: string) => {
         const selectedGoal = goal ?? "pick_myself";
         const result = await fromPromise(
            (async () => {
               const created = await createWorkspace.mutateAsync({
                  workspaceName,
                  onboardingGoal: selectedGoal,
                  isMultiOrgCreation,
               });

               await authClient.organization.setActive({
                  organizationId: created.orgId,
               });

               await authClient.organization.setActiveTeam({
                  teamId: created.teamId,
               });

               posthog.group("organization", created.orgId, {
                  onboarding_goal: selectedGoal,
                  onboarding_version: ONBOARDING_VERSION,
               });

               posthog.capture("workspace_created", {
                  onboarding_goal: selectedGoal,
                  onboarding_version: ONBOARDING_VERSION,
                  is_multi_org_creation: isMultiOrgCreation,
                  organization_id: created.orgId,
                  team_id: created.teamId,
               });

               await navigate({
                  to: "/$slug/$teamSlug/home",
                  params: {
                     slug: created.orgSlug,
                     teamSlug: created.teamSlug,
                  },
               });
            })(),
            () => "Erro ao criar espaço.",
         );

         if (result.isErr()) toast.error(result.error);
      },
      [createWorkspace, goal, isMultiOrgCreation, navigate],
   );

   const handleBack = useCallback(() => {
      const previous = steps[currentIndex - 1];
      if (!previous) return;
      void navigateSearch({ step: previous.id });
   }, [currentIndex, navigateSearch, steps]);

   return (
      <div className="flex min-h-screen flex-col">
         <header className="shrink-0 border-b p-4">
            <div className="flex w-full items-center gap-4">
               <nav className="grid flex-1 grid-cols-3 gap-2">
                  {steps.map((item, index) => (
                     <StepProgressItem
                        isCurrent={item.id === step}
                        isDone={index < currentIndex}
                        key={item.id}
                        position={index + 1}
                        title={item.title}
                     />
                  ))}
               </nav>
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
                  </Badge>
               </div>
            </div>
         </header>

         <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
            <div className="w-full max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-200">
               {step === "profile" && (
                  <ProfileStep
                     defaultName={session.user.name ?? ""}
                     isFirstStep={currentIndex === 0}
                     onBack={handleBack}
                     onNext={handleProfileComplete}
                  />
               )}

               {step === "goal" && (
                  <GoalStep
                     goal={goal}
                     isFirstStep={currentIndex === 0}
                     isMultiOrgCreation={isMultiOrgCreation}
                     navigateSearch={navigateSearch}
                     onBack={handleBack}
                  />
               )}

               {step === "company" && (
                  <CompanyStep
                     isCreating={createWorkspace.isPending}
                     isFirstStep={currentIndex === 0}
                     onBack={handleBack}
                     onCreateWorkspace={handleCreateWorkspace}
                  />
               )}
            </div>
         </main>
      </div>
   );
}

function StepProgressItem({
   isCurrent,
   isDone,
   position,
   title,
}: {
   isCurrent: boolean;
   isDone: boolean;
   position: number;
   title: string;
}) {
   return (
      <div className="flex items-center gap-2">
         <div
            className={
               isCurrent || isDone
                  ? "flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  : "flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
            }
         >
            {isDone ? <Check className="size-4" /> : position}
         </div>
         <span className="text-sm font-medium">{title}</span>
      </div>
   );
}

function StepFooter({
   canContinue,
   isFirstStep,
   isPending,
   onBack,
   submitLabel = "Continuar",
}: {
   canContinue: boolean;
   isFirstStep: boolean;
   isPending: boolean;
   onBack: () => void;
   submitLabel?: string;
}) {
   return (
      <footer className="fixed inset-x-0 bottom-0 p-4">
         <div className="flex w-full gap-4">
            {!isFirstStep && (
               <Button
                  disabled={isPending}
                  onClick={onBack}
                  type="button"
                  variant="outline"
               >
                  Voltar
               </Button>
            )}
            <Button
               className="flex-1"
               disabled={isPending || !canContinue}
               type="submit"
            >
               {isPending ? <Spinner className="size-4" /> : submitLabel}
            </Button>
         </div>
      </footer>
   );
}

function ProfileStep({
   defaultName,
   isFirstStep,
   onBack,
   onNext,
}: {
   defaultName: string;
   isFirstStep: boolean;
   onBack: () => void;
   onNext: () => void;
}) {
   const form = useForm({
      defaultValues: { userName: defaultName },
      onSubmit: async ({ value }) => {
         const result = await fromPromise(
            authClient.updateUser({ name: value.userName }),
            () => "Erro ao atualizar nome.",
         );

         if (result.isErr()) {
            toast.error(result.error);
            return;
         }

         toast.success("Nome atualizado!");
         onNext();
      },
      validators: { onBlur: profileSchema },
   });
   const userName = useStore(form.store, (state) => state.values.userName);
   const isPending = useStore(form.store, (state) => state.isSubmitting);
   const canContinue = userName.trim().length >= 2 && !isPending;

   const handleSubmit = useCallback(
      (event: FormEvent) => {
         event.preventDefault();
         event.stopPropagation();
         void form.handleSubmit();
      },
      [form],
   );

   return (
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
         <div className="flex flex-col gap-2 text-center">
            <h2 className="font-serif text-2xl font-semibold">
               Como podemos te chamar?
            </h2>
            <p className="text-sm text-muted-foreground">
               Usado para personalizar sua experiência.
            </p>
         </div>

         <FieldGroup>
            <form.Field
               name="userName"
               children={(field) => {
                  const isInvalid =
                     field.state.meta.isTouched &&
                     field.state.meta.errors.length > 0;
                  return (
                     <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Seu Nome</FieldLabel>
                        <Input
                           aria-invalid={isInvalid}
                           autoComplete="name"
                           autoFocus
                           disabled={isPending}
                           id={field.name}
                           name={field.name}
                           onBlur={field.handleBlur}
                           onChange={(event) =>
                              field.handleChange(event.target.value)
                           }
                           placeholder="Ex: João Silva"
                           value={field.state.value}
                        />
                        {isInvalid && (
                           <FieldError errors={field.state.meta.errors} />
                        )}
                     </Field>
                  );
               }}
            />
         </FieldGroup>

         <StepFooter
            canContinue={canContinue}
            isFirstStep={isFirstStep}
            isPending={isPending}
            onBack={onBack}
         />
      </form>
   );
}

function GoalStep({
   goal,
   isFirstStep,
   isMultiOrgCreation,
   navigateSearch,
   onBack,
}: {
   goal: OnboardingGoal | null;
   isFirstStep: boolean;
   isMultiOrgCreation: boolean;
   navigateSearch: NavigateSearch;
   onBack: () => void;
}) {
   const handleSubmit = useCallback(
      (event: FormEvent) => {
         event.preventDefault();
         if (!goal) return;
         void navigateSearch({ step: "company" });
      },
      [goal, navigateSearch],
   );

   return (
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
         <div className="flex flex-col gap-2 text-center">
            <h2 className="font-serif text-2xl font-semibold">
               O que você quer fazer primeiro na Montte?
            </h2>
            <p className="text-sm text-muted-foreground">
               Vamos ajustar os primeiros passos do seu ERP com base nessa
               escolha.
            </p>
         </div>

         <div className="grid gap-4 md:grid-cols-3">
            {GOAL_OPTIONS.map(({ id, title, description, Icon }) => (
               <button
                  aria-pressed={goal === id}
                  className={cn(
                     "flex min-h-40 items-start gap-4 rounded-md border bg-card p-4 text-left transition-colors",
                     goal === id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted",
                  )}
                  key={id}
                  onClick={() => {
                     void navigateSearch({ goal: id });
                     posthog.capture("onboarding_goal_selected", {
                        onboarding_goal: id,
                        onboarding_version: ONBOARDING_VERSION,
                        is_multi_org_creation: isMultiOrgCreation,
                     });
                  }}
                  type="button"
               >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                     <Icon className="size-5" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                     <span className="font-medium">{title}</span>
                     <span className="text-sm text-muted-foreground">
                        {description}
                     </span>
                  </div>
                  <div
                     className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        goal === id
                           ? "border-primary bg-primary"
                           : "border-border",
                     )}
                  >
                     {goal === id && (
                        <Check className="size-2 text-primary-foreground" />
                     )}
                  </div>
               </button>
            ))}
         </div>

         <StepFooter
            canContinue={goal !== null}
            isFirstStep={isFirstStep}
            isPending={false}
            onBack={onBack}
         />
      </form>
   );
}

function CompanyStep({
   isCreating,
   isFirstStep,
   onBack,
   onCreateWorkspace,
}: {
   isCreating: boolean;
   isFirstStep: boolean;
   onBack: () => void;
   onCreateWorkspace: (workspaceName: string) => Promise<void>;
}) {
   const form = useForm({
      defaultValues: { workspaceName: "" },
      onSubmit: async ({ value }) => {
         await onCreateWorkspace(value.workspaceName.trim());
      },
      validators: { onBlur: companySchema },
   });
   const workspaceName = useStore(
      form.store,
      (state) => state.values.workspaceName,
   );
   const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
   const isPending = isCreating || isSubmitting;
   const canContinue = workspaceName.trim().length >= 2 && !isPending;
   const preview = workspaceName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);

   const handleSubmit = useCallback(
      (event: FormEvent) => {
         event.preventDefault();
         event.stopPropagation();
         void form.handleSubmit();
      },
      [form],
   );

   return (
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
         <div className="flex flex-col gap-2 text-center">
            <h2 className="font-serif text-2xl font-semibold">
               Como se chama sua empresa?
            </h2>
            <p className="text-sm text-muted-foreground">
               Vamos criar sua organização e o projeto principal.
            </p>
         </div>

         <FieldGroup>
            <form.Field
               name="workspaceName"
               children={(field) => {
                  const isInvalid =
                     field.state.meta.isTouched &&
                     field.state.meta.errors.length > 0;

                  return (
                     <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                           Nome da empresa
                        </FieldLabel>
                        <Input
                           aria-invalid={isInvalid}
                           autoComplete="organization"
                           autoFocus
                           disabled={isPending}
                           id={field.name}
                           name={field.name}
                           onBlur={field.handleBlur}
                           onChange={(event) =>
                              field.handleChange(event.target.value)
                           }
                           placeholder="Ex: Montte Tecnologia"
                           value={field.state.value}
                        />
                        {preview && (
                           <p className="text-xs text-muted-foreground">
                              app.montte.co/{preview}/principal
                           </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                           CNPJ e dados fiscais ficam fora deste cadastro
                           inicial.
                        </p>
                        {isInvalid && (
                           <FieldError errors={field.state.meta.errors} />
                        )}
                     </Field>
                  );
               }}
            />
         </FieldGroup>

         <StepFooter
            canContinue={canContinue}
            isFirstStep={isFirstStep}
            isPending={isPending}
            onBack={onBack}
            submitLabel="Concluir"
         />
      </form>
   );
}
