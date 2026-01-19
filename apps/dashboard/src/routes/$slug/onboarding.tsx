import {
   Alert,
   AlertDescription,
   AlertTitle,
} from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Toggle } from "@packages/ui/components/toggle";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
   BarChart3Icon,
   CheckCircle2Icon,
   ChevronLeftIcon,
   ChevronRightIcon,
   PiggyBankIcon,
   ShieldCheckIcon,
   UserIcon,
   WalletIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { BankAccountCombobox } from "@/features/bank-account/ui/bank-account-combobox";
import {
   getIconComponent,
   type IconName,
} from "@/features/icon-selector/lib/available-icons";
import { betterAuthClient, useTRPC } from "@/integrations/clients";

const defaultCategoryKeys = [
   "food",
   "health",
   "housing",
   "leisure",
   "shopping",
   "transport",
] as const;

type DefaultCategoryKey = (typeof defaultCategoryKeys)[number];

const defaultCategoriesConfig: Record<
   DefaultCategoryKey,
   { color: string; icon: IconName }
> = {
   food: {
      color: "#f97316",
      icon: "UtensilsCrossed",
   },
   health: {
      color: "#ef4444",
      icon: "Heart",
   },
   housing: {
      color: "#3b82f6",
      icon: "Home",
   },
   leisure: {
      color: "#8b5cf6",
      icon: "Gamepad",
   },
   shopping: {
      color: "#22c55e",
      icon: "ShoppingBag",
   },
   transport: {
      color: "#0ea5e9",
      icon: "Car",
   },
};

const defaultCategoryLabels: Record<DefaultCategoryKey, string> = {
   food: "Alimentacao",
   health: "Saude",
   housing: "Moradia",
   leisure: "Lazer",
   shopping: "Compras gerais",
   transport: "Transporte",
};

const bankAccountSchema = z.object({
   bank: z.string().min(1, "Banco e obrigatorio"),
   bankAccountName: z.string().optional(),
   bankAccountType: z.string().min(1, "Tipo de conta e obrigatorio"),
});

type StepId =
   | "welcome"
   | "profile"
   | "account-created"
   | "additional-account"
   | "categories";

const allPossibleSteps: StepId[] = [
   "welcome",
   "profile",
   "account-created",
   "additional-account",
   "categories",
];

const searchSchema = z.object({
   step: z
      .enum([
         "welcome",
         "profile",
         "account-created",
         "additional-account",
         "categories",
      ])
      .optional()
      .default("welcome"),
});

export const Route = createFileRoute("/$slug/onboarding")({
   component: RouteComponent,
   validateSearch: searchSchema,
});

function RouteComponent() {
   const trpc = useTRPC();
   const navigate = useNavigate({ from: "/$slug/onboarding" });
   const { slug } = Route.useParams();
   const { step } = Route.useSearch();

   const [selectedDefaultCategories, setSelectedDefaultCategories] = useState<
      DefaultCategoryKey[]
   >([]);
   const [profileName, setProfileName] = useState("");

   const { data: session } = useQuery(trpc.session.getSession.queryOptions());

   const { data: onboardingStatus } = useQuery(
      trpc.onboarding.getOnboardingStatus.queryOptions(),
   );

   // Compute effective steps based on whether user has a name
   const effectiveSteps = useMemo(() => {
      const userName = session?.user?.name?.trim();
      if (userName && userName.length > 0) {
         return allPossibleSteps.filter((s) => s !== "profile");
      }
      return allPossibleSteps;
   }, [session?.user?.name]);

   const currentStepIndex = effectiveSteps.indexOf(step);
   const totalSteps = effectiveSteps.length;

   const createDefaultPersonalAccount = useMutation(
      trpc.bankAccounts.createDefaultPersonal.mutationOptions({
         onError: (error) => {
            toast.error(error.message);
         },
         onSuccess: () => {
            navigate({
               params: { slug },
               search: { step: "account-created" },
            });
         },
      }),
   );

   const createBankAccount = useMutation(
      trpc.bankAccounts.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message);
         },
         onSuccess: () => {
            toast.success("Conta bancaria criada com sucesso");
            navigate({
               params: { slug },
               search: { step: "categories" },
            });
         },
      }),
   );

   const createCategory = useMutation(
      trpc.categories.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message);
         },
      }),
   );

   const completeOnboarding = useMutation(
      trpc.onboarding.completeOnboarding.mutationOptions({
         onError: (error) => {
            toast.error(error.message);
         },
         onSuccess: () => {
            navigate({ params: { slug }, to: "/$slug/home" });
         },
      }),
   );

   const updateUserName = useMutation({
      mutationFn: async (name: string) => {
         return betterAuthClient.updateUser({ name });
      },
      onError: () => {
         toast.error("Erro ao salvar o nome. Tente novamente.");
      },
      onSuccess: () => {
         // After saving name, create default account and navigate
         const isBusinessContext =
            onboardingStatus?.organizationContext === "business";
         const defaultName = isBusinessContext ? "Caixa" : "Carteira";
         const defaultBank = isBusinessContext ? "Caixa" : "Padrao";
         createDefaultPersonalAccount.mutate({
            name: defaultName,
            bank: defaultBank,
         });
      },
   });

   const createSelectedCategories = useCallback(async () => {
      await Promise.all(
         selectedDefaultCategories.map((key) => {
            const label = defaultCategoryLabels[key];
            const config = defaultCategoriesConfig[key];

            return createCategory.mutateAsync({
               color: config.color,
               icon: config.icon,
               name: label,
            });
         }),
      );
   }, [selectedDefaultCategories, createCategory]);

   const handleFinishOnboarding = async () => {
      await createSelectedCategories();
      await completeOnboarding.mutateAsync();
   };

   const handleWelcomeNext = () => {
      // Check if profile step is in the effective steps (user needs to enter name)
      const nextStep = effectiveSteps[effectiveSteps.indexOf("welcome") + 1];

      if (nextStep === "profile") {
         // User needs to enter their name first
         navigate({
            params: { slug },
            search: { step: "profile" },
         });
      } else {
         // User already has a name, create default account directly
         const isBusinessContext =
            onboardingStatus?.organizationContext === "business";
         const defaultName = isBusinessContext ? "Caixa" : "Carteira";
         const defaultBank = isBusinessContext ? "Caixa" : "Padrao";
         createDefaultPersonalAccount.mutate({
            name: defaultName,
            bank: defaultBank,
         });
      }
   };

   const handleProfileNext = () => {
      const trimmedName = profileName.trim();
      if (trimmedName.length < 2) {
         return;
      }
      updateUserName.mutate(trimmedName);
   };

   const bankAccountForm = useForm({
      defaultValues: {
         bank: "",
         bankAccountName: "",
         bankAccountType: "checking",
      },
      onSubmit: async ({ value, formApi }) => {
         await createBankAccount.mutateAsync({
            bank: value.bank,
            name: value.bankAccountName,
            type: value.bankAccountType as
               | "checking"
               | "savings"
               | "investment",
         });
         formApi.reset();
      },
      validators: {
         onBlur: ({ value }) => {
            const result = bankAccountSchema.safeParse(value);
            if (!result.success) {
               const errors: Record<string, string[]> = {};
               result.error.issues.forEach((err) => {
                  const path = err.path[0] as string;
                  if (path) {
                     if (!errors[path]) {
                        errors[path] = [];
                     }
                     errors[path].push(err.message);
                  }
               });
               return errors;
            }
         },
      },
   });

   const goToPreviousStep = () => {
      if (currentStepIndex > 0) {
         const prevStep = effectiveSteps[currentStepIndex - 1];
         navigate({
            params: { slug },
            search: { step: prevStep },
         });
      }
   };

   const goToNextStep = () => {
      if (currentStepIndex < totalSteps - 1) {
         const nextStep = effectiveSteps[currentStepIndex + 1];
         navigate({
            params: { slug },
            search: { step: nextStep },
         });
      }
   };

   const getStepTitle = () => {
      switch (step) {
         case "welcome":
            return "Bem-vindo ao Montte";
         case "profile":
            return "Como podemos te chamar?";
         case "account-created":
            return "Conta Criada";
         case "additional-account":
            return "Adicionar Outra Conta Bancaria";
         case "categories":
            return "Categorias iniciais";
         default:
            return "";
      }
   };

   const getStepDescription = () => {
      switch (step) {
         case "welcome":
            return "Gerencie suas financas pessoais de forma simples e eficiente.";
         case "profile":
            return "Nos diga seu nome para personalizar sua experiencia.";
         case "account-created":
            return "Sua conta padrao foi criada com sucesso.";
         case "additional-account":
            return "Voce pode adicionar outra conta bancaria agora ou pular esta etapa.";
         case "categories":
            return "Selecione algumas categorias padrao para comecar.";
         default:
            return "";
      }
   };

   const renderStep = () => {
      switch (step) {
         case "welcome":
            return (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card">
                     <div className="p-3 rounded-full bg-primary/10">
                        <WalletIcon className="size-6 text-primary" />
                     </div>
                     <div className="text-center space-y-1">
                        <p className="font-medium font-serif">
                           Carteira Digital
                        </p>
                        <p className="text-sm text-muted-foreground">
                           Organize suas contas e transacoes em um so lugar.
                        </p>
                     </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card">
                     <div className="p-3 rounded-full bg-primary/10">
                        <PiggyBankIcon className="size-6 text-primary" />
                     </div>
                     <div className="text-center space-y-1">
                        <p className="font-medium font-serif">Orcamentos</p>
                        <p className="text-sm text-muted-foreground">
                           Defina orcamentos mensais e acompanhe seus gastos.
                        </p>
                     </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card">
                     <div className="p-3 rounded-full bg-primary/10">
                        <BarChart3Icon className="size-6 text-primary" />
                     </div>
                     <div className="text-center space-y-1">
                        <p className="font-medium font-serif">Relatorios</p>
                        <p className="text-sm text-muted-foreground">
                           Visualize relatorios detalhados das suas financas.
                        </p>
                     </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card">
                     <div className="p-3 rounded-full bg-primary/10">
                        <ShieldCheckIcon className="size-6 text-primary" />
                     </div>
                     <div className="text-center space-y-1">
                        <p className="font-medium font-serif">Seguranca</p>
                        <p className="text-sm text-muted-foreground">
                           Seus dados protegidos com criptografia de ponta.
                        </p>
                     </div>
                  </div>
               </div>
            );

         case "profile":
            return (
               <div className="max-w-md mx-auto space-y-4">
                  <div className="flex flex-col items-center gap-4 p-6 rounded-lg border bg-card">
                     <div className="p-4 rounded-full bg-primary/10">
                        <UserIcon className="size-8 text-primary" />
                     </div>
                     <div className="text-center space-y-1">
                        <p className="text-sm text-muted-foreground">
                           Este nome sera usado para identifica-lo na
                           plataforma.
                        </p>
                     </div>
                  </div>
                  <FieldGroup>
                     <Field>
                        <FieldLabel htmlFor="profile-name">Seu nome</FieldLabel>
                        <Input
                           autoFocus
                           id="profile-name"
                           name="profile-name"
                           onChange={(e) => setProfileName(e.target.value)}
                           placeholder="Digite seu nome"
                           value={profileName}
                        />
                        <FieldDescription>
                           Voce pode alterar isso depois nas configuracoes.
                        </FieldDescription>
                     </Field>
                  </FieldGroup>
               </div>
            );

         case "account-created": {
            const isBusinessContext =
               onboardingStatus?.organizationContext === "business";
            const title = isBusinessContext
               ? "Conta 'Caixa' criada com sucesso"
               : "Conta 'Carteira' criada com sucesso";
            const description = isBusinessContext
               ? "A conta 'Caixa' foi criada e esta pronta para uso. Voce pode adicionar mais contas a qualquer momento."
               : "A conta 'Carteira' foi criada e esta pronta para uso. Voce pode adicionar mais contas a qualquer momento.";

            return (
               <div className="max-w-md mx-auto">
                  <Alert>
                     <CheckCircle2Icon className="size-4" />
                     <AlertTitle>{title}</AlertTitle>
                     <AlertDescription>{description}</AlertDescription>
                  </Alert>
               </div>
            );
         }

         case "additional-account":
            return (
               <form
                  className="space-y-4"
                  onSubmit={(e) => {
                     e.preventDefault();
                     bankAccountForm.handleSubmit();
                  }}
               >
                  <FieldGroup>
                     <bankAccountForm.Field name="bankAccountName">
                        {(field) => (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 Apelido da Conta
                              </FieldLabel>
                              <Input
                                 id={field.name}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Ex: Conta Salario, Banco Principal"
                                 value={field.state.value}
                              />
                              <FieldDescription>
                                 Opcional. Use para identificar facilmente esta
                                 conta, como 'Conta Salario' ou 'Banco
                                 Principal'
                              </FieldDescription>
                           </Field>
                        )}
                     </bankAccountForm.Field>
                  </FieldGroup>

                  <FieldGroup>
                     <bankAccountForm.Field name="bank">
                        {(field) => {
                           const isInvalid =
                              field.state.meta.isTouched &&
                              !field.state.meta.isValid;
                           return (
                              <Field data-invalid={isInvalid}>
                                 <FieldLabel htmlFor={field.name}>
                                    Banco
                                 </FieldLabel>
                                 <BankAccountCombobox
                                    onBlur={field.handleBlur}
                                    onValueChange={field.handleChange}
                                    value={field.state.value}
                                 />
                                 {isInvalid && (
                                    <FieldError
                                       errors={field.state.meta.errors}
                                    />
                                 )}
                              </Field>
                           );
                        }}
                     </bankAccountForm.Field>
                  </FieldGroup>

                  <FieldGroup>
                     <bankAccountForm.Field name="bankAccountType">
                        {(field) => (
                           <Field>
                              <FieldLabel>Tipo de Conta</FieldLabel>
                              <Select
                                 onValueChange={(value) =>
                                    field.handleChange(value)
                                 }
                                 value={field.state.value}
                              >
                                 <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo de conta" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="checking">
                                       Corrente
                                    </SelectItem>
                                    <SelectItem value="savings">
                                       Poupanca
                                    </SelectItem>
                                    <SelectItem value="investment">
                                       Investimento
                                    </SelectItem>
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </bankAccountForm.Field>
                  </FieldGroup>
               </form>
            );

         case "categories":
            return (
               <FieldGroup>
                  <Field>
                     <FieldLabel>Categorias sugeridas</FieldLabel>
                     <div className="flex flex-wrap gap-2 justify-center">
                        {defaultCategoryKeys.map((key) => {
                           const isSelected =
                              selectedDefaultCategories.includes(key);
                           const label = defaultCategoryLabels[key];
                           const config = defaultCategoriesConfig[key];
                           const Icon = getIconComponent(config.icon);

                           return (
                              <Toggle
                                 aria-pressed={isSelected}
                                 className="gap-2 px-3"
                                 key={key}
                                 onPressedChange={(pressed) => {
                                    setSelectedDefaultCategories((prev) => {
                                       if (pressed) {
                                          return prev.includes(key)
                                             ? prev
                                             : [...prev, key];
                                       }

                                       return prev.filter(
                                          (item) => item !== key,
                                       );
                                    });
                                 }}
                                 pressed={isSelected}
                                 size="sm"
                                 style={{
                                    backgroundColor: isSelected
                                       ? `${config.color}15`
                                       : undefined,
                                    borderColor: isSelected
                                       ? config.color
                                       : undefined,
                                 }}
                                 type="button"
                                 variant="outline"
                              >
                                 <Icon
                                    className="size-4"
                                    style={{ color: config.color }}
                                 />
                                 {label}
                              </Toggle>
                           );
                        })}
                     </div>
                  </Field>
               </FieldGroup>
            );

         default:
            return null;
      }
   };

   const StepIndicator = () => (
      <div className="flex items-center gap-4">
         <div className="flex items-center gap-1.5">
            {effectiveSteps.map((stepId, index) => (
               <div
                  className={`h-1 w-8 rounded-full transition-colors duration-300 ${
                     index <= currentStepIndex ? "bg-primary" : "bg-muted"
                  }`}
                  key={stepId}
               />
            ))}
         </div>
         <span className="text-sm text-muted-foreground whitespace-nowrap">
            {`Passo ${currentStepIndex + 1} de ${totalSteps}`}
         </span>
      </div>
   );

   return (
      <div className="min-h-screen flex flex-col">
         <header className="p-4">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
               <div className="w-10" />
               <StepIndicator />
               <div className="w-10" />
            </div>
         </header>

         <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl space-y-8">
               <div className="text-center space-y-2">
                  <h1 className="text-3xl font-semibold font-serif">
                     {getStepTitle()}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                     {getStepDescription()}
                  </p>
               </div>

               <div className="space-y-4">{renderStep()}</div>
            </div>
         </div>

         <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-2xl mx-auto p-4 flex items-center justify-between">
               <Button
                  className="gap-2"
                  disabled={currentStepIndex === 0}
                  onClick={goToPreviousStep}
                  variant="ghost"
               >
                  <ChevronLeftIcon className="size-4" />
                  Voltar
               </Button>

               <div className="flex items-center gap-2">
                  {step === "welcome" && (
                     <Button
                        className="gap-2"
                        disabled={createDefaultPersonalAccount.isPending}
                        onClick={handleWelcomeNext}
                     >
                        {createDefaultPersonalAccount.isPending
                           ? "Carregando..."
                           : "Proximo"}
                        <ChevronRightIcon className="size-4" />
                     </Button>
                  )}
                  {step === "profile" && (
                     <Button
                        className="gap-2"
                        disabled={
                           profileName.trim().length < 2 ||
                           updateUserName.isPending
                        }
                        onClick={handleProfileNext}
                     >
                        {updateUserName.isPending ? "Carregando..." : "Proximo"}
                        <ChevronRightIcon className="size-4" />
                     </Button>
                  )}
                  {step === "account-created" && (
                     <Button className="gap-2" onClick={goToNextStep}>
                        Proximo
                        <ChevronRightIcon className="size-4" />
                     </Button>
                  )}
                  {step === "additional-account" && (
                     <>
                        <Button
                           onClick={() =>
                              navigate({
                                 params: { slug },
                                 search: { step: "categories" },
                              })
                           }
                           variant="outline"
                        >
                           Pular
                        </Button>
                        <bankAccountForm.Subscribe
                           selector={(state) => ({
                              bank: state.values.bank,
                              isSubmitting: state.isSubmitting,
                           })}
                        >
                           {({ bank, isSubmitting }) => (
                              <Button
                                 className="gap-2"
                                 disabled={
                                    !bank ||
                                    isSubmitting ||
                                    createBankAccount.isPending
                                 }
                                 onClick={() => bankAccountForm.handleSubmit()}
                              >
                                 Proximo
                                 <ChevronRightIcon className="size-4" />
                              </Button>
                           )}
                        </bankAccountForm.Subscribe>
                     </>
                  )}
                  {step === "categories" && (
                     <Button
                        className="gap-2"
                        disabled={
                           selectedDefaultCategories.length === 0 ||
                           createCategory.isPending ||
                           completeOnboarding.isPending
                        }
                        onClick={handleFinishOnboarding}
                     >
                        Enviar
                        <ChevronRightIcon className="size-4" />
                     </Button>
                  )}
               </div>
            </div>
         </footer>
      </div>
   );
}
