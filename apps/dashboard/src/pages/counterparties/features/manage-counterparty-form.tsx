import type { Counterparty } from "@packages/database/repositories/counterparty-repository";
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxIndicator,
   ChoiceboxItem,
   ChoiceboxItemDescription,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
} from "@packages/ui/components/choicebox";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Spinner } from "@packages/ui/components/spinner";
import { defineStepper } from "@packages/ui/components/stepper";
import { Textarea } from "@packages/ui/components/textarea";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
   Building2,
   CheckIcon,
   ChevronDown,
   ChevronsUpDownIcon,
   HelpCircle,
   User,
   Users,
} from "lucide-react";
import { type FormEvent, useCallback, useMemo, useState } from "react";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type ManageCounterpartyFormProps = {
   counterparty?: Counterparty;
};

type CounterpartyType = "client" | "supplier" | "both";
type StepId = "type" | "basic-info" | "contact" | "address" | "financial";

const allSteps: Array<{ id: StepId; title: string }> = [
   { id: "type", title: "type" },
   { id: "basic-info", title: "basic-info" },
   { id: "contact", title: "contact" },
   { id: "address", title: "address" },
   { id: "financial", title: "financial" },
];

const { Stepper } = defineStepper(...allSteps);

// Constants
const DOCUMENT_TYPES = [
   { label: "CPF", value: "cpf" },
   { label: "CNPJ", value: "cnpj" },
   { label: "Estrangeiro", value: "foreign" },
] as const;

const BRAZILIAN_STATES = [
   { label: "Acre", value: "AC" },
   { label: "Alagoas", value: "AL" },
   { label: "Amapá", value: "AP" },
   { label: "Amazonas", value: "AM" },
   { label: "Bahia", value: "BA" },
   { label: "Ceará", value: "CE" },
   { label: "Distrito Federal", value: "DF" },
   { label: "Espírito Santo", value: "ES" },
   { label: "Goiás", value: "GO" },
   { label: "Maranhão", value: "MA" },
   { label: "Mato Grosso", value: "MT" },
   { label: "Mato Grosso do Sul", value: "MS" },
   { label: "Minas Gerais", value: "MG" },
   { label: "Pará", value: "PA" },
   { label: "Paraíba", value: "PB" },
   { label: "Paraná", value: "PR" },
   { label: "Pernambuco", value: "PE" },
   { label: "Piauí", value: "PI" },
   { label: "Rio de Janeiro", value: "RJ" },
   { label: "Rio Grande do Norte", value: "RN" },
   { label: "Rio Grande do Sul", value: "RS" },
   { label: "Rondônia", value: "RO" },
   { label: "Roraima", value: "RR" },
   { label: "Santa Catarina", value: "SC" },
   { label: "São Paulo", value: "SP" },
   { label: "Sergipe", value: "SE" },
   { label: "Tocantins", value: "TO" },
] as const;

const TAX_REGIMES = [
   {
      description: "Empresas com faturamento até R$ 4,8 milhões/ano",
      label: "Simples Nacional",
      value: "simples",
   },
   {
      description: "Empresas com faturamento até R$ 78 milhões/ano",
      label: "Lucro Presumido",
      value: "lucro_presumido",
   },
   {
      description: "Obrigatório para grandes empresas",
      label: "Lucro Real",
      value: "lucro_real",
   },
   {
      description: "Microempreendedor Individual",
      label: "MEI",
      value: "mei",
   },
] as const;

const PAYMENT_TERMS_OPTIONS = [
   { label: "À vista", value: 0 },
   { label: "7 dias", value: 7 },
   { label: "14 dias", value: 14 },
   { label: "30 dias", value: 30 },
   { label: "45 dias", value: 45 },
   { label: "60 dias", value: 60 },
] as const;

const COMMON_INDUSTRIES = [
   "Tecnologia",
   "Varejo",
   "Serviços",
   "Indústria",
   "Construção",
   "Alimentação",
   "Saúde",
   "Educação",
   "Transporte",
   "Agricultura",
] as const;

// Helper functions
function detectDocumentType(digits: string): "cpf" | "cnpj" | "foreign" | null {
   if (digits.length === 11) return "cpf";
   if (digits.length === 14) return "cnpj";
   return null;
}

function formatDocument(
   digits: string,
   type: "cpf" | "cnpj" | "foreign" | null,
): string {
   if (!type || type === "foreign") return digits;

   if (type === "cpf") {
      const limited = digits.slice(0, 11);
      if (limited.length <= 3) return limited;
      if (limited.length <= 6)
         return `${limited.slice(0, 3)}.${limited.slice(3)}`;
      if (limited.length <= 9)
         return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
      return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
   }

   if (type === "cnpj") {
      const limited = digits.slice(0, 14);
      if (limited.length <= 2) return limited;
      if (limited.length <= 5)
         return `${limited.slice(0, 2)}.${limited.slice(2)}`;
      if (limited.length <= 8)
         return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
      if (limited.length <= 12)
         return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
      return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12)}`;
   }

   return digits;
}

function formatPhone(digits: string): string {
   const limited = digits.replace(/\D/g, "").slice(0, 11);
   if (limited.length <= 2) return limited;
   if (limited.length <= 7)
      return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
   if (limited.length <= 10)
      return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
   return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
}

function formatCEP(digits: string): string {
   const limited = digits.replace(/\D/g, "").slice(0, 8);
   if (limited.length <= 5) return limited;
   return `${limited.slice(0, 5)}-${limited.slice(5)}`;
}

type BrasilAPICepResponse = {
   cep: string;
   city: string;
   neighborhood: string;
   state: string;
   street: string;
};

function getActiveSteps(
   selectedType: CounterpartyType | null,
   isEditMode: boolean,
): StepId[] {
   if (isEditMode) {
      return ["basic-info", "contact", "address", "financial"];
   }

   if (!selectedType) {
      return ["type"];
   }

   return ["type", "basic-info", "contact", "address", "financial"];
}

export function ManageCounterpartyForm({
   counterparty,
}: ManageCounterpartyFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const isEditMode = !!counterparty;

   const [selectedType, setSelectedType] = useState<CounterpartyType | null>(
      (counterparty?.type as CounterpartyType) || null,
   );
   const [showBasicAdvanced, setShowBasicAdvanced] = useState(false);
   const [showFinancialAdvanced, setShowFinancialAdvanced] = useState(false);
   const [isLoadingCep, setIsLoadingCep] = useState(false);
   const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);
   const [industryComboboxOpen, setIndustryComboboxOpen] = useState(false);
   const [industrySearch, setIndustrySearch] = useState("");

   const activeSteps = useMemo(
      () => getActiveSteps(selectedType, isEditMode),
      [selectedType, isEditMode],
   );

   const modeTexts = useMemo(() => {
      const createTexts = {
         description:
            "Preencha os dados para cadastrar um novo parceiro comercial",
         title: "Novo Cadastro",
      };

      const editTexts = {
         description: `Editando o cadastro de ${counterparty?.name || ""}`,
         title: "Editar Cadastro",
      };

      return isEditMode ? editTexts : createTexts;
   }, [isEditMode, counterparty?.name]);

   // Queries
   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const { data: bankAccounts = [] } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   const { data: industries = [] } = useQuery(
      trpc.counterparties.getIndustries.queryOptions(),
   );

   const activeBankAccounts = useMemo(
      () => bankAccounts.filter((account) => account.status === "active"),
      [bankAccounts],
   );

   const allIndustries = useMemo(() => {
      return [...new Set([...industries, ...COMMON_INDUSTRIES])].sort();
   }, [industries]);

   const filteredIndustries = industrySearch
      ? allIndustries.filter((ind) =>
           ind.toLowerCase().includes(industrySearch.toLowerCase()),
        )
      : allIndustries;

   // Mutations
   const createCounterpartyMutation = useMutation(
      trpc.counterparties.create.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const updateCounterpartyMutation = useMutation(
      trpc.counterparties.update.mutationOptions({
         onError: (error) => {
            console.error("Failed to update counterparty:", error);
         },
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const isPending =
      createCounterpartyMutation.isPending ||
      updateCounterpartyMutation.isPending;

   const defaultValues = counterparty
      ? {
           addressCity: counterparty.addressCity || "",
           addressComplement: counterparty.addressComplement || "",
           addressNeighborhood: counterparty.addressNeighborhood || "",
           addressNumber: counterparty.addressNumber || "",
           addressState: counterparty.addressState || "",
           addressStreet: counterparty.addressStreet || "",
           addressZipCode: counterparty.addressZipCode || "",
           creditLimit: counterparty.creditLimit
              ? Number(counterparty.creditLimit)
              : undefined,
           defaultBankAccountId: counterparty.defaultBankAccountId || undefined,
           defaultCategoryId: counterparty.defaultCategoryId || undefined,
           document: counterparty.document || "",
           documentType: counterparty.documentType || undefined,
           email: counterparty.email || "",
           industry: counterparty.industry || "",
           legalName: counterparty.legalName || "",
           municipalRegistration: counterparty.municipalRegistration || "",
           name: counterparty.name || "",
           notes: counterparty.notes || "",
           paymentTermsDays: counterparty.paymentTermsDays
              ? Number(counterparty.paymentTermsDays)
              : 30,
           phone: counterparty.phone || "",
           stateRegistration: counterparty.stateRegistration || "",
           taxRegime: counterparty.taxRegime || undefined,
           tradeName: counterparty.tradeName || "",
           type: counterparty.type as CounterpartyType,
           website: counterparty.website || "",
        }
      : {
           addressCity: "",
           addressComplement: "",
           addressNeighborhood: "",
           addressNumber: "",
           addressState: "",
           addressStreet: "",
           addressZipCode: "",
           creditLimit: undefined as number | undefined,
           defaultBankAccountId: undefined as string | undefined,
           defaultCategoryId: undefined as string | undefined,
           document: "",
           documentType: undefined as "cpf" | "cnpj" | "foreign" | undefined,
           email: "",
           industry: "",
           legalName: "",
           municipalRegistration: "",
           name: "",
           notes: "",
           paymentTermsDays: 30,
           phone: "",
           stateRegistration: "",
           taxRegime: undefined as
              | "simples"
              | "lucro_presumido"
              | "lucro_real"
              | "mei"
              | undefined,
           tradeName: "",
           type: null as CounterpartyType | null,
           website: "",
        };

   const form = useForm({
      defaultValues,
      onSubmit: async ({ value }) => {
         if (!value.name || !value.type) {
            return;
         }

         try {
            const data = {
               addressCity: value.addressCity || undefined,
               addressComplement: value.addressComplement || undefined,
               addressNeighborhood: value.addressNeighborhood || undefined,
               addressNumber: value.addressNumber || undefined,
               addressState: value.addressState || undefined,
               addressStreet: value.addressStreet || undefined,
               addressZipCode: value.addressZipCode || undefined,
               creditLimit: value.creditLimit || undefined,
               defaultBankAccountId: value.defaultBankAccountId || undefined,
               defaultCategoryId: value.defaultCategoryId || undefined,
               document: value.document || undefined,
               documentType: value.documentType || undefined,
               email: value.email || undefined,
               industry: value.industry || undefined,
               legalName: value.legalName || undefined,
               municipalRegistration: value.municipalRegistration || undefined,
               name: value.name,
               notes: value.notes || undefined,
               paymentTermsDays: value.paymentTermsDays || undefined,
               phone: value.phone || undefined,
               stateRegistration: value.stateRegistration || undefined,
               taxRegime: value.taxRegime || undefined,
               tradeName: value.tradeName || undefined,
               type: value.type,
               website: value.website || undefined,
            };

            if (isEditMode && counterparty) {
               await updateCounterpartyMutation.mutateAsync({
                  data,
                  id: counterparty.id,
               });
            } else {
               await createCounterpartyMutation.mutateAsync(data);
            }
         } catch (error) {
            console.error(
               `Failed to ${isEditMode ? "update" : "create"} counterparty:`,
               error,
            );
         }
      },
   });

   const handleSubmit = useCallback(
      (e: FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         form.handleSubmit();
      },
      [form],
   );

   const fetchAddressFromCep = async (cep: string) => {
      const digitsOnly = cep.replace(/\D/g, "");
      if (digitsOnly.length !== 8) return;

      setIsLoadingCep(true);
      try {
         const response = await fetch(
            `https://brasilapi.com.br/api/cep/v2/${digitsOnly}`,
         );

         if (!response.ok) {
            throw new Error("CEP not found");
         }

         const data: BrasilAPICepResponse = await response.json();

         if (data.street) form.setFieldValue("addressStreet", data.street);
         if (data.neighborhood)
            form.setFieldValue("addressNeighborhood", data.neighborhood);
         if (data.city) form.setFieldValue("addressCity", data.city);
         if (data.state) form.setFieldValue("addressState", data.state);
      } catch (error) {
         console.error("Failed to fetch address from CEP:", error);
      } finally {
         setIsLoadingCep(false);
      }
   };

   // Step Components
   function TypeStep() {
      const counterpartyTypeOptions = [
         {
            bgColor: "bg-emerald-500/10",
            description: "Empresa ou pessoa que compra de você",
            icon: User,
            iconColor: "text-emerald-500",
            title: "Cliente",
            value: "client" as CounterpartyType,
         },
         {
            bgColor: "bg-blue-500/10",
            description: "Empresa ou pessoa que vende para você",
            icon: Building2,
            iconColor: "text-blue-500",
            title: "Fornecedor",
            value: "supplier" as CounterpartyType,
         },
         {
            bgColor: "bg-purple-500/10",
            description: "Empresa ou pessoa com quem você compra e vende",
            icon: Users,
            iconColor: "text-purple-500",
            title: "Cliente e Fornecedor",
            value: "both" as CounterpartyType,
         },
      ];

      return (
         <div className="space-y-4">
            <div className="text-center mb-6">
               <p className="text-sm text-muted-foreground">
                  Qual é o tipo do parceiro comercial?
               </p>
            </div>

            <form.Field name="type">
               {(field) => (
                  <Choicebox
                     className="grid gap-3"
                     onValueChange={(value) => {
                        const type = value as CounterpartyType;
                        field.handleChange(type);
                        setSelectedType(type);
                     }}
                     value={field.state.value || ""}
                  >
                     {counterpartyTypeOptions.map((option) => {
                        const IconComponent = option.icon;
                        return (
                           <ChoiceboxItem
                              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                              id={option.value}
                              key={option.value}
                              value={option.value}
                           >
                              <div className="flex items-center gap-3">
                                 <div
                                    className={`p-2 rounded-lg ${option.bgColor} ${option.iconColor}`}
                                 >
                                    <IconComponent className="size-5" />
                                 </div>
                                 <ChoiceboxItemHeader>
                                    <ChoiceboxItemTitle>
                                       {option.title}
                                    </ChoiceboxItemTitle>
                                    <ChoiceboxItemDescription>
                                       {option.description}
                                    </ChoiceboxItemDescription>
                                 </ChoiceboxItemHeader>
                              </div>
                              <ChoiceboxIndicator id={option.value} />
                           </ChoiceboxItem>
                        );
                     })}
                  </Choicebox>
               )}
            </form.Field>
         </div>
      );
   }

   function BasicInfoStep() {
      return (
         <div className="space-y-4">
            <div className="text-center mb-6">
               <p className="text-sm text-muted-foreground">
                  Informe os dados básicos do parceiro comercial
               </p>
            </div>

            <FieldGroup>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Nome <span className="text-destructive">*</span>
                           </FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Nome do parceiro comercial"
                              value={field.state.value || ""}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <div className="grid grid-cols-2 gap-3">
               <FieldGroup>
                  <form.Field name="documentType">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Tipo de documento
                           </FieldLabel>
                           <Select
                              onValueChange={(value) =>
                                 field.handleChange(
                                    value as "cpf" | "cnpj" | "foreign",
                                 )
                              }
                              value={field.state.value || ""}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                 {DOCUMENT_TYPES.map((docType) => (
                                    <SelectItem
                                       key={docType.value}
                                       value={docType.value}
                                    >
                                       {docType.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="document">
                     {(field) => (
                        <form.Subscribe
                           selector={(state) => state.values.documentType}
                        >
                           {(documentType) => {
                              const handleDocumentChange = (value: string) => {
                                 const digitsOnly = value.replace(/\D/g, "");

                                 if (!documentType) {
                                    const detectedType =
                                       detectDocumentType(digitsOnly);
                                    if (detectedType) {
                                       form.setFieldValue(
                                          "documentType",
                                          detectedType,
                                       );
                                    }
                                 }

                                 const formatted = formatDocument(
                                    digitsOnly,
                                    documentType ||
                                       detectDocumentType(digitsOnly),
                                 );
                                 field.handleChange(formatted);
                              };

                              const getPlaceholder = () => {
                                 if (documentType === "cpf")
                                    return "000.000.000-00";
                                 if (documentType === "cnpj")
                                    return "00.000.000/0000-00";
                                 return "Documento";
                              };

                              return (
                                 <Field>
                                    <FieldLabel htmlFor={field.name}>
                                       Documento
                                    </FieldLabel>
                                    <Input
                                       id={field.name}
                                       onBlur={field.handleBlur}
                                       onChange={(e) =>
                                          handleDocumentChange(e.target.value)
                                       }
                                       placeholder={getPlaceholder()}
                                       value={field.state.value || ""}
                                    />
                                 </Field>
                              );
                           }}
                        </form.Subscribe>
                     )}
                  </form.Field>
               </FieldGroup>
            </div>

            <Collapsible
               onOpenChange={setShowBasicAdvanced}
               open={showBasicAdvanced}
            >
               <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-sm">
                  <span className="font-medium text-muted-foreground">
                     Mais opções
                  </span>
                  <ChevronDown
                     className={`h-4 w-4 text-muted-foreground transition-transform ${
                        showBasicAdvanced ? "rotate-180" : ""
                     }`}
                  />
               </CollapsibleTrigger>
               <CollapsibleContent>
                  <div className="pt-4 space-y-4">
                     <FieldGroup>
                        <form.Field name="tradeName">
                           {(field) => (
                              <Field>
                                 <FieldLabel htmlFor={field.name}>
                                    Nome fantasia
                                 </FieldLabel>
                                 <Input
                                    id={field.name}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                       field.handleChange(e.target.value)
                                    }
                                    placeholder="Nome fantasia da empresa"
                                    value={field.state.value || ""}
                                 />
                              </Field>
                           )}
                        </form.Field>
                     </FieldGroup>

                     <FieldGroup>
                        <form.Field name="legalName">
                           {(field) => (
                              <Field>
                                 <FieldLabel htmlFor={field.name}>
                                    Razão social
                                 </FieldLabel>
                                 <Input
                                    id={field.name}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                       field.handleChange(e.target.value)
                                    }
                                    placeholder="Razão social da empresa"
                                    value={field.state.value || ""}
                                 />
                              </Field>
                           )}
                        </form.Field>
                     </FieldGroup>

                     <form.Subscribe
                        selector={(state) => state.values.documentType}
                     >
                        {(documentType) =>
                           documentType === "cnpj" && (
                              <>
                                 <FieldGroup>
                                    <form.Field name="stateRegistration">
                                       {(field) => (
                                          <Field>
                                             <FieldLabel htmlFor={field.name}>
                                                Inscrição estadual
                                             </FieldLabel>
                                             <Input
                                                id={field.name}
                                                onBlur={field.handleBlur}
                                                onChange={(e) =>
                                                   field.handleChange(
                                                      e.target.value,
                                                   )
                                                }
                                                placeholder="Inscrição estadual"
                                                value={field.state.value || ""}
                                             />
                                          </Field>
                                       )}
                                    </form.Field>
                                 </FieldGroup>

                                 <FieldGroup>
                                    <form.Field name="municipalRegistration">
                                       {(field) => (
                                          <Field>
                                             <FieldLabel htmlFor={field.name}>
                                                Inscrição municipal
                                             </FieldLabel>
                                             <Input
                                                id={field.name}
                                                onBlur={field.handleBlur}
                                                onChange={(e) =>
                                                   field.handleChange(
                                                      e.target.value,
                                                   )
                                                }
                                                placeholder="Inscrição municipal"
                                                value={field.state.value || ""}
                                             />
                                          </Field>
                                       )}
                                    </form.Field>
                                 </FieldGroup>
                              </>
                           )
                        }
                     </form.Subscribe>
                  </div>
               </CollapsibleContent>
            </Collapsible>
         </div>
      );
   }

   function ContactStep() {
      return (
         <div className="space-y-4">
            <div className="text-center mb-6">
               <p className="text-sm text-muted-foreground">
                  Adicione as informações de contato (opcional)
               </p>
            </div>

            <FieldGroup>
               <form.Field name="email">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        !field.state.meta.isValid &&
                        field.state.value !== "";
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="email@exemplo.com.br"
                              type="email"
                              value={field.state.value || ""}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="phone">
                  {(field) => {
                     const handlePhoneChange = (value: string) => {
                        const digitsOnly = value.replace(/\D/g, "");
                        const limited = digitsOnly.slice(0, 11);
                        field.handleChange(limited);
                     };

                     const handlePhoneBlur = () => {
                        field.handleBlur();
                        if (field.state.value) {
                           const formatted = formatPhone(field.state.value);
                           field.handleChange(formatted);
                        }
                     };

                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Telefone
                           </FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={handlePhoneBlur}
                              onChange={(e) =>
                                 handlePhoneChange(e.target.value)
                              }
                              placeholder="(00) 00000-0000"
                              type="tel"
                              value={field.state.value || ""}
                           />
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="website">
                  {(field) => {
                     const handleWebsiteBlur = () => {
                        field.handleBlur();
                        if (
                           field.state.value &&
                           !field.state.value.startsWith("http://") &&
                           !field.state.value.startsWith("https://")
                        ) {
                           field.handleChange(`https://${field.state.value}`);
                        }
                     };

                     const isInvalid =
                        field.state.meta.isTouched &&
                        !field.state.meta.isValid &&
                        field.state.value !== "";

                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Website</FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={handleWebsiteBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="www.exemplo.com.br"
                              type="url"
                              value={field.state.value || ""}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>
         </div>
      );
   }

   function AddressStep() {
      return (
         <div className="space-y-4">
            <div className="text-center mb-6">
               <p className="text-sm text-muted-foreground">
                  Adicione o endereço (opcional)
               </p>
            </div>

            <FieldGroup>
               <form.Field name="addressZipCode">
                  {(field) => {
                     const handleCepChange = (value: string) => {
                        const digitsOnly = value.replace(/\D/g, "");
                        const limited = digitsOnly.slice(0, 8);
                        field.handleChange(limited);
                     };

                     const handleCepBlur = async () => {
                        field.handleBlur();
                        if (field.state.value) {
                           const formatted = formatCEP(field.state.value);
                           field.handleChange(formatted);
                           await fetchAddressFromCep(field.state.value);
                        }
                     };

                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name}>CEP</FieldLabel>
                           <div className="relative">
                              <Input
                                 id={field.name}
                                 onBlur={handleCepBlur}
                                 onChange={(e) =>
                                    handleCepChange(e.target.value)
                                 }
                                 placeholder="00000-000"
                                 value={field.state.value || ""}
                              />
                              {isLoadingCep && (
                                 <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Spinner className="h-4 w-4" />
                                 </div>
                              )}
                           </div>
                           <p className="text-xs text-muted-foreground mt-1">
                              Digite o CEP para preencher o endereço
                              automaticamente
                           </p>
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="addressStreet">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>Rua</FieldLabel>
                        <Input
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Nome da rua ou avenida"
                           value={field.state.value || ""}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <div className="grid grid-cols-3 gap-3">
               <FieldGroup className="col-span-1">
                  <form.Field name="addressNumber">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Número</FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="123"
                              value={field.state.value || ""}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               <FieldGroup className="col-span-2">
                  <form.Field name="addressComplement">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Complemento
                           </FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Apto, sala, bloco..."
                              value={field.state.value || ""}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </div>

            <FieldGroup>
               <form.Field name="addressNeighborhood">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>Bairro</FieldLabel>
                        <Input
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Nome do bairro"
                           value={field.state.value || ""}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <div className="grid grid-cols-3 gap-3">
               <FieldGroup className="col-span-2">
                  <form.Field name="addressCity">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Cidade</FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Nome da cidade"
                              value={field.state.value || ""}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               <FieldGroup className="col-span-1">
                  <form.Field name="addressState">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>UF</FieldLabel>
                           <Select
                              onValueChange={(value) =>
                                 field.handleChange(value)
                              }
                              value={field.state.value || ""}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue placeholder="UF" />
                              </SelectTrigger>
                              <SelectContent>
                                 {BRAZILIAN_STATES.map((state) => (
                                    <SelectItem
                                       key={state.value}
                                       value={state.value}
                                    >
                                       {state.value} - {state.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </div>
         </div>
      );
   }

   function FinancialStep() {
      return (
         <div className="space-y-4">
            <div className="text-center mb-6">
               <p className="text-sm text-muted-foreground">
                  Configure as opções financeiras (opcional)
               </p>
            </div>

            <FieldGroup>
               <form.Field name="paymentTermsDays">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Prazo de pagamento
                        </FieldLabel>
                        <div className="flex flex-wrap gap-2">
                           {PAYMENT_TERMS_OPTIONS.map((option) => (
                              <Button
                                 className="h-8 px-3 text-sm"
                                 key={`payment-term-${option.value}`}
                                 onClick={() =>
                                    field.handleChange(option.value)
                                 }
                                 size="sm"
                                 type="button"
                                 variant={
                                    field.state.value === option.value
                                       ? "default"
                                       : "outline"
                                 }
                              >
                                 {option.label}
                              </Button>
                           ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                           <Input
                              className="w-24"
                              max={365}
                              min={0}
                              onChange={(e) =>
                                 field.handleChange(
                                    e.target.value ? Number(e.target.value) : 0,
                                 )
                              }
                              placeholder="30"
                              type="number"
                              value={field.state.value || ""}
                           />
                           <span className="text-sm text-muted-foreground">
                              dias
                           </span>
                        </div>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="creditLimit">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Limite de crédito
                        </FieldLabel>
                        <MoneyInput
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(value) => {
                              field.handleChange(value || undefined);
                           }}
                           placeholder="0,00"
                           value={field.state.value}
                           valueInCents={false}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="notes">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Observações
                        </FieldLabel>
                        <Textarea
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Adicione observações sobre este parceiro"
                           rows={3}
                           value={field.state.value || ""}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <Collapsible
               onOpenChange={setShowFinancialAdvanced}
               open={showFinancialAdvanced}
            >
               <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-sm">
                  <span className="font-medium text-muted-foreground">
                     Mais opções
                  </span>
                  <ChevronDown
                     className={`h-4 w-4 text-muted-foreground transition-transform ${
                        showFinancialAdvanced ? "rotate-180" : ""
                     }`}
                  />
               </CollapsibleTrigger>
               <CollapsibleContent>
                  <div className="pt-4 space-y-4">
                     <FieldGroup>
                        <form.Field name="industry">
                           {(field) => (
                              <Field>
                                 <FieldLabel htmlFor={field.name}>
                                    Setor de atuação
                                 </FieldLabel>
                                 <Popover
                                    onOpenChange={setIndustryComboboxOpen}
                                    open={industryComboboxOpen}
                                 >
                                    <PopoverTrigger asChild>
                                       <Button
                                          aria-expanded={industryComboboxOpen}
                                          className="w-full justify-between"
                                          role="combobox"
                                          variant="outline"
                                       >
                                          {field.state.value ? (
                                             <span>{field.state.value}</span>
                                          ) : (
                                             <span className="text-muted-foreground">
                                                Selecione o setor
                                             </span>
                                          )}
                                          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                       </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                       <Command shouldFilter={false}>
                                          <CommandInput
                                             onValueChange={setIndustrySearch}
                                             placeholder="Buscar setor..."
                                             value={industrySearch}
                                          />
                                          <CommandList>
                                             <CommandEmpty>
                                                Nenhum setor encontrado
                                             </CommandEmpty>
                                             <CommandGroup>
                                                {filteredIndustries.map(
                                                   (ind) => (
                                                      <CommandItem
                                                         key={ind}
                                                         onSelect={() => {
                                                            field.handleChange(
                                                               ind,
                                                            );
                                                            setIndustryComboboxOpen(
                                                               false,
                                                            );
                                                            setIndustrySearch(
                                                               "",
                                                            );
                                                         }}
                                                         value={ind}
                                                      >
                                                         <span className="flex-1">
                                                            {ind}
                                                         </span>
                                                         {field.state.value ===
                                                            ind && (
                                                            <CheckIcon className="ml-2 h-4 w-4" />
                                                         )}
                                                      </CommandItem>
                                                   ),
                                                )}
                                             </CommandGroup>
                                          </CommandList>
                                       </Command>
                                    </PopoverContent>
                                 </Popover>
                              </Field>
                           )}
                        </form.Field>
                     </FieldGroup>

                     <FieldGroup>
                        <form.Field name="taxRegime">
                           {(field) => (
                              <Field>
                                 <div className="flex items-center gap-1">
                                    <FieldLabel htmlFor={field.name}>
                                       Regime tributário
                                    </FieldLabel>
                                    <TooltipProvider>
                                       <Tooltip>
                                          <TooltipTrigger asChild>
                                             <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                             <p>
                                                O regime tributário define como
                                                os impostos são calculados.
                                                Consulte o contador se não
                                                souber.
                                             </p>
                                          </TooltipContent>
                                       </Tooltip>
                                    </TooltipProvider>
                                 </div>
                                 <Select
                                    onValueChange={(value) =>
                                       field.handleChange(
                                          value as
                                             | "simples"
                                             | "lucro_presumido"
                                             | "lucro_real"
                                             | "mei",
                                       )
                                    }
                                    value={field.state.value || ""}
                                 >
                                    <SelectTrigger id={field.name}>
                                       <SelectValue placeholder="Selecione o regime" />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {TAX_REGIMES.map((regime) => (
                                          <SelectItem
                                             key={regime.value}
                                             value={regime.value}
                                          >
                                             <div className="flex flex-col">
                                                <span>{regime.label}</span>
                                                <span className="text-xs text-muted-foreground">
                                                   {regime.description}
                                                </span>
                                             </div>
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </Field>
                           )}
                        </form.Field>
                     </FieldGroup>

                     <FieldGroup>
                        <form.Field name="defaultBankAccountId">
                           {(field) => (
                              <Field>
                                 <FieldLabel htmlFor={field.name}>
                                    Conta bancária padrão
                                 </FieldLabel>
                                 <Select
                                    onValueChange={(value) =>
                                       field.handleChange(
                                          value === "none" ? undefined : value,
                                       )
                                    }
                                    value={field.state.value || "none"}
                                 >
                                    <SelectTrigger id={field.name}>
                                       <SelectValue placeholder="Selecione a conta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                       <SelectItem value="none">-</SelectItem>
                                       {activeBankAccounts.map((account) => (
                                          <SelectItem
                                             key={account.id}
                                             value={account.id}
                                          >
                                             {account.name} - {account.bank}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </Field>
                           )}
                        </form.Field>
                     </FieldGroup>

                     <FieldGroup>
                        <form.Field name="defaultCategoryId">
                           {(field) => {
                              const selectedCategory = categories.find(
                                 (cat) => cat.id === field.state.value,
                              );

                              return (
                                 <Field>
                                    <FieldLabel htmlFor={field.name}>
                                       Categoria padrão
                                    </FieldLabel>
                                    <Popover
                                       onOpenChange={setCategoryComboboxOpen}
                                       open={categoryComboboxOpen}
                                    >
                                       <PopoverTrigger asChild>
                                          <Button
                                             aria-expanded={
                                                categoryComboboxOpen
                                             }
                                             className="w-full justify-between"
                                             role="combobox"
                                             variant="outline"
                                          >
                                             {selectedCategory ? (
                                                <div className="flex items-center gap-2">
                                                   <IconDisplay
                                                      iconName={
                                                         selectedCategory.icon as IconName
                                                      }
                                                      size={16}
                                                   />
                                                   <span>
                                                      {selectedCategory.name}
                                                   </span>
                                                </div>
                                             ) : (
                                                <span className="text-muted-foreground">
                                                   Selecione uma categoria
                                                </span>
                                             )}
                                             <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                       </PopoverTrigger>
                                       <PopoverContent className="w-full p-0">
                                          <Command>
                                             <CommandInput placeholder="Buscar categoria..." />
                                             <CommandList>
                                                <CommandEmpty>
                                                   Nenhuma categoria encontrada
                                                </CommandEmpty>
                                                <CommandGroup>
                                                   {categories.map(
                                                      (category) => (
                                                         <CommandItem
                                                            key={category.id}
                                                            onSelect={() => {
                                                               field.handleChange(
                                                                  category.id ===
                                                                     field.state
                                                                        .value
                                                                     ? undefined
                                                                     : category.id,
                                                               );
                                                               setCategoryComboboxOpen(
                                                                  false,
                                                               );
                                                            }}
                                                            value={
                                                               category.name
                                                            }
                                                         >
                                                            <div className="flex items-center gap-2 flex-1">
                                                               <IconDisplay
                                                                  iconName={
                                                                     category.icon as IconName
                                                                  }
                                                                  size={16}
                                                               />
                                                               <span>
                                                                  {
                                                                     category.name
                                                                  }
                                                               </span>
                                                            </div>
                                                            {field.state
                                                               .value ===
                                                               category.id && (
                                                               <CheckIcon className="ml-2 h-4 w-4" />
                                                            )}
                                                         </CommandItem>
                                                      ),
                                                   )}
                                                </CommandGroup>
                                             </CommandList>
                                          </Command>
                                       </PopoverContent>
                                    </Popover>
                                 </Field>
                              );
                           }}
                        </form.Field>
                     </FieldGroup>
                  </div>
               </CollapsibleContent>
            </Collapsible>
         </div>
      );
   }

   return (
      <Stepper.Provider className="h-full" initialStep={activeSteps[0]}>
         {({ methods }) => (
            <form className="h-full flex flex-col" onSubmit={handleSubmit}>
               <SheetHeader>
                  <SheetTitle>{modeTexts.title}</SheetTitle>
                  <SheetDescription>{modeTexts.description}</SheetDescription>
               </SheetHeader>

               <div className="px-4 py-2">
                  <Stepper.Navigation>
                     {allSteps
                        .filter((step) => activeSteps.includes(step.id))
                        .map((step) => (
                           <Stepper.Step key={step.id} of={step.id} />
                        ))}
                  </Stepper.Navigation>
               </div>

               <div className="px-4 flex-1 overflow-y-auto">
                  {methods.switch({
                     address: () => <AddressStep />,
                     "basic-info": () => <BasicInfoStep />,
                     contact: () => <ContactStep />,
                     financial: () => <FinancialStep />,
                     type: () => <TypeStep />,
                  })}
               </div>

               <SheetFooter className="px-4">
                  <Stepper.Controls className="flex flex-col w-full gap-2">
                     {methods.current.id === "type" ? (
                        <form.Subscribe
                           selector={(state) => ({
                              typeValue: state.values.type,
                           })}
                        >
                           {({ typeValue }) => (
                              <Button
                                 className="w-full"
                                 disabled={!typeValue}
                                 onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    methods.next();
                                 }}
                                 type="button"
                              >
                                 Próximo
                              </Button>
                           )}
                        </form.Subscribe>
                     ) : methods.isLast ? (
                        <form.Subscribe
                           selector={(state) => ({
                              canSubmit: state.canSubmit,
                              isSubmitting: state.isSubmitting,
                              nameValid: !!state.values.name,
                           })}
                        >
                           {({ canSubmit, isSubmitting, nameValid }) => (
                              <>
                                 <Button
                                    className="w-full"
                                    onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       methods.prev();
                                    }}
                                    type="button"
                                    variant="ghost"
                                 >
                                    Anterior
                                 </Button>
                                 <Button
                                    className="w-full"
                                    disabled={
                                       !canSubmit ||
                                       isSubmitting ||
                                       isPending ||
                                       !nameValid
                                    }
                                    type="submit"
                                 >
                                    Salvar
                                 </Button>
                              </>
                           )}
                        </form.Subscribe>
                     ) : (
                        <>
                           {!isEditMode && (
                              <Button
                                 className="w-full"
                                 onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    methods.prev();
                                 }}
                                 type="button"
                                 variant="ghost"
                              >
                                 Anterior
                              </Button>
                           )}
                           <Button
                              className="w-full"
                              onClick={(e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 methods.next();
                              }}
                              type="button"
                           >
                              Próximo
                           </Button>
                        </>
                     )}
                  </Stepper.Controls>
               </SheetFooter>
            </form>
         )}
      </Stepper.Provider>
   );
}
