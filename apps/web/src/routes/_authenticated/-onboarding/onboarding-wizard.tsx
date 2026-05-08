import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Progress } from "@packages/ui/components/progress";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { fromPromise } from "neverthrow";
import posthog from "posthog-js";
import { Banknote, Briefcase, Check, UsersRound } from "lucide-react";
import { type FormEvent, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
   authClient,
   type Session,
} from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const ONBOARDING_VERSION = "2026-05";

type OnboardingStep = "profile" | "features" | "company";
type OnboardingFeature = "finance" | "contacts" | "services";

type Organization = {
   id: string;
   name: string;
   slug: string;
   logo: string | null;
   role: string;
   onboardingCompleted: boolean | null;
};

type StepItem = { id: OnboardingStep };

type NavigateSearch = (search: {
   step?: OnboardingStep;
   features?: OnboardingFeature[];
   new?: boolean;
}) => void | Promise<void>;

interface OnboardingWizardProps {
   session: NonNullable<Session>;
   organizations: Organization[];
   activeOrg: Organization | null;
   step: OnboardingStep;
   features: OnboardingFeature[];
   isNewOrganization: boolean;
   navigateSearch: NavigateSearch;
}

const FEATURE_OPTIONS: {
   id: OnboardingFeature;
   title: string;
   description: string;
   Icon: typeof Banknote;
}[] = [
   {
      id: "finance",
      title: "Finanças",
      description: "Contas, cartões, categorias e lançamentos.",
      Icon: Banknote,
   },
   {
      id: "contacts",
      title: "Negócios",
      description: "Contatos, clientes e relacionamentos.",
      Icon: Briefcase,
   },
   {
      id: "services",
      title: "Serviços",
      description: "Serviços, benefícios e cobranças.",
      Icon: UsersRound,
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
   features,
   isNewOrganization,
   navigateSearch,
}: OnboardingWizardProps) {
   const navigate = useNavigate();
   const createWorkspace = useMutation(
      orpc.onboarding.createWorkspace.mutationOptions(),
   );

   const steps = useMemo<StepItem[]>(() => {
      if (!activeOrg && !session.user.name) {
         return [{ id: "profile" }, { id: "features" }, { id: "company" }];
      }

      if (!activeOrg) {
         return [{ id: "features" }, { id: "company" }];
      }

      return [{ id: "profile" }];
   }, [activeOrg, session.user.name]);

   const currentIndex = Math.max(
      steps.findIndex((item) => item.id === step),
      0,
   );
   const isMultiOrgCreation = isNewOrganization || organizations.length > 0;

   const handleProfileComplete = useCallback(() => {
      if (!activeOrg) {
         void navigateSearch({ step: "features" });
         return;
      }

      navigate({ to: "/$slug", params: { slug: activeOrg.slug } });
   }, [activeOrg, navigate, navigateSearch]);

   const handleCreateWorkspace = useCallback(
      async (workspaceName: string) => {
         const result = await fromPromise(
            (async () => {
               const created = await createWorkspace.mutateAsync({
                  workspaceName,
                  features,
                  isMultiOrgCreation,
               });

               await authClient.organization.setActive({
                  organizationId: created.orgId,
               });

               await authClient.organization.setActiveTeam({
                  teamId: created.teamId,
               });

               posthog.group("organization", created.orgId, {
                  onboarding_features: features,
                  onboarding_version: ONBOARDING_VERSION,
               });

               await navigate({
                  to: "/$slug/$teamSlug/inbox",
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
      [createWorkspace, features, isMultiOrgCreation, navigate],
   );

   const handleBack = useCallback(() => {
      const previous = steps[currentIndex - 1];
      if (!previous) return;
      void navigateSearch({ step: previous.id });
   }, [currentIndex, navigateSearch, steps]);

   const progress = Math.round(((currentIndex + 1) / steps.length) * 100);

   return (
      <div className="flex min-h-screen flex-col">
         <header className="shrink-0 border-b p-4">
            <div className="flex w-full items-center gap-4">
               <img
                  alt="Montte"
                  className="size-8 shrink-0 rounded-full"
                  src="/favicon.svg"
               />
               <Progress className="flex-1" value={progress} />
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

               {step === "features" && (
                  <FeaturesStep
                     features={features}
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

function FeaturesStep({
   features,
   isFirstStep,
   isMultiOrgCreation,
   navigateSearch,
   onBack,
}: {
   features: OnboardingFeature[];
   isFirstStep: boolean;
   isMultiOrgCreation: boolean;
   navigateSearch: NavigateSearch;
   onBack: () => void;
}) {
   const toggleFeature = useCallback(
      (id: OnboardingFeature) => {
         const next = features.includes(id)
            ? features.filter((f) => f !== id)
            : [...features, id];
         void navigateSearch({ features: next });
         posthog.capture("onboarding_features_changed", {
            onboarding_features: next,
            onboarding_version: ONBOARDING_VERSION,
            is_multi_org_creation: isMultiOrgCreation,
         });
      },
      [features, isMultiOrgCreation, navigateSearch],
   );

   const handleSubmit = useCallback(
      (event: FormEvent) => {
         event.preventDefault();
         void navigateSearch({ step: "company" });
      },
      [navigateSearch],
   );

   return (
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
         <div className="flex flex-col gap-2 text-center">
            <h2 className="font-serif text-2xl font-semibold">
               O que você vai usar no Montte?
            </h2>
            <p className="text-sm text-muted-foreground">
               Escolha as áreas que fazem sentido hoje. Você pode ativar outras
               depois.
            </p>
         </div>

         <div className="grid gap-4 md:grid-cols-3">
            {FEATURE_OPTIONS.map(({ id, title, description, Icon }) => {
               const isSelected = features.includes(id);
               return (
                  <button
                     aria-pressed={isSelected}
                     className={cn(
                        "flex min-h-40 items-start gap-4 rounded-md border bg-card p-4 text-left transition-colors",
                        isSelected
                           ? "border-primary bg-primary/5"
                           : "border-border hover:bg-muted",
                     )}
                     key={id}
                     onClick={() => toggleFeature(id)}
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
                           "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                           isSelected
                              ? "border-primary bg-primary"
                              : "border-border",
                        )}
                     >
                        {isSelected && (
                           <Check className="size-2 text-primary-foreground" />
                        )}
                     </div>
                  </button>
               );
            })}
         </div>

         <StepFooter
            canContinue
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
