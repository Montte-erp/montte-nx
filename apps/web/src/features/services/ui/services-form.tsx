import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Separator } from "@packages/ui/components/separator";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, PlusCircle, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { ServiceRow } from "./services-columns";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ServiceType = "service" | "product" | "subscription";

const TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
   { value: "service", label: "Prestação de serviço" },
   { value: "product", label: "Produto" },
   { value: "subscription", label: "Assinatura" },
];

type BillingCycle = "hourly" | "monthly" | "annual" | "one_time";

const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
   hourly: "Por hora",
   monthly: "Mensal",
   annual: "Anual",
   one_time: "Pagamento único",
};

const BILLING_CYCLE_OPTIONS: BillingCycle[] = [
   "hourly",
   "monthly",
   "annual",
   "one_time",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VariantFormValue {
   name: string;
   basePrice: number;
   billingCycle: BillingCycle;
}

interface ServiceFormProps {
   mode: "create" | "edit";
   service?: ServiceRow;
   onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionTrigger({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold [&[data-state=open]>svg]:rotate-180">
         {children}
         <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200" />
      </CollapsibleTrigger>
   );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServiceForm({ mode, service, onSuccess }: ServiceFormProps) {
   const isCreate = mode === "create";
   const [isPending, startTransition] = useTransition();

   const { data: categories } = useQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const { data: tags } = useQuery(orpc.tags.getAll.queryOptions({}));

   const { data: existingVariants } = useQuery(
      orpc.services.getVariants.queryOptions({
         input: { serviceId: service?.id ?? "" },
         enabled: !isCreate && !!service?.id,
      }),
   );

   const createMutation = useMutation(
      orpc.services.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao criar serviço.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.services.update.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar serviço.");
         },
      }),
   );

   const createVariantMutation = useMutation(
      orpc.services.createVariant.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao criar variante.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         name: service?.name ?? "",
         description: service?.description ?? "",
         type: (service?.type ?? "service") as ServiceType,
         basePrice: service?.basePrice ?? 0,
         categoryId: service?.categoryId ?? "",
         tagId: service?.tagId ?? "",
         variants: [] as VariantFormValue[],
      },
      onSubmit: async ({ value }) => {
         const categoryId = value.categoryId.trim() || undefined;
         const tagId = value.tagId.trim() || undefined;

         if (isCreate) {
            const created = await createMutation.mutateAsync({
               name: value.name.trim(),
               description: value.description.trim() || undefined,
               basePrice: value.basePrice,
               type: value.type,
               categoryId,
               tagId,
               isActive: true,
            });

            if (value.variants.length > 0) {
               await Promise.all(
                  value.variants.map((v) =>
                     createVariantMutation.mutateAsync({
                        serviceId: created.id,
                        name: v.name.trim(),
                        basePrice: v.basePrice,
                        billingCycle: v.billingCycle as BillingCycle,
                        isActive: true,
                     }),
                  ),
               );
            }

            toast.success("Serviço criado.");
         } else if (service) {
            await updateMutation.mutateAsync({
               id: service.id,
               name: value.name.trim(),
               description: value.description.trim() || undefined,
               basePrice: value.basePrice,
               type: value.type,
               categoryId,
               tagId,
            });
            toast.success("Serviço atualizado.");
         }

         onSuccess();
      },
   });

   const mutationsPending =
      createMutation.isPending ||
      updateMutation.isPending ||
      createVariantMutation.isPending;

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startTransition(async () => {
         await form.handleSubmit();
      });
   };

   return (
      <form className="h-full flex flex-col" onSubmit={handleSubmit}>
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Novo Serviço" : "Editar Serviço"}
            </CredenzaTitle>
         </CredenzaHeader>

         <CredenzaBody className="space-y-1">
            {/* ── Section 1: Informações básicas (always open) ── */}
            <Collapsible defaultOpen>
               <SectionTrigger>Informações básicas</SectionTrigger>
               <CollapsibleContent>
                  <FieldGroup className="pt-2">
                     <div className="grid grid-cols-2 gap-3">
                        {/* Name */}
                        <form.Field name="name">
                           {(field) => {
                              const isInvalid =
                                 field.state.meta.isTouched &&
                                 !field.state.meta.isValid;
                              return (
                                 <Field data-invalid={isInvalid}>
                                    <FieldLabel>Nome *</FieldLabel>
                                    <Input
                                       onBlur={field.handleBlur}
                                       onChange={(e) =>
                                          field.handleChange(e.target.value)
                                       }
                                       placeholder="Ex: Consultoria Mensal"
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
                        </form.Field>

                        {/* Base Price */}
                        <form.Field name="basePrice">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Preço padrão *</FieldLabel>
                                 <MoneyInput
                                    onChange={(v) =>
                                       field.handleChange(v ?? 0)
                                    }
                                    value={field.state.value}
                                    valueInCents={true}
                                 />
                              </Field>
                           )}
                        </form.Field>
                     </div>

                     {/* Type */}
                     <form.Field name="type">
                        {(field) => (
                           <Field>
                              <FieldLabel>Tipo *</FieldLabel>
                              <Select
                                 onValueChange={(v) =>
                                    field.handleChange(v as ServiceType)
                                 }
                                 value={field.state.value}
                              >
                                 <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {TYPE_OPTIONS.map((opt) => (
                                       <SelectItem
                                          key={opt.value}
                                          value={opt.value}
                                       >
                                          {opt.label}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </form.Field>

                     {/* Description */}
                     <form.Field name="description">
                        {(field) => (
                           <Field>
                              <FieldLabel>Descrição</FieldLabel>
                              <Textarea
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Descrição do serviço (opcional)"
                                 rows={2}
                                 value={field.state.value}
                              />
                           </Field>
                        )}
                     </form.Field>
                  </FieldGroup>
               </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* ── Section 2: Classificação ── */}
            <Collapsible defaultOpen={!isCreate && !!(service?.categoryId || service?.tagId)}>
               <SectionTrigger>Classificação</SectionTrigger>
               <CollapsibleContent>
                  <FieldGroup className="pt-2">
                     <div className="grid grid-cols-2 gap-3">
                        {/* Category */}
                        <form.Field name="categoryId">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Categoria</FieldLabel>
                                 <Select
                                    onValueChange={(v) =>
                                       field.handleChange(v)
                                    }
                                    value={field.state.value}
                                 >
                                    <SelectTrigger>
                                       <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {categories?.map((cat) => (
                                          <SelectItem
                                             key={cat.id}
                                             value={cat.id}
                                          >
                                             {cat.name}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </Field>
                           )}
                        </form.Field>

                        {/* Tag */}
                        <form.Field name="tagId">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Tag</FieldLabel>
                                 <Select
                                    onValueChange={(v) =>
                                       field.handleChange(v)
                                    }
                                    value={field.state.value}
                                 >
                                    <SelectTrigger>
                                       <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {tags?.map((tag) => (
                                          <SelectItem
                                             key={tag.id}
                                             value={tag.id}
                                          >
                                             {tag.name}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </Field>
                           )}
                        </form.Field>
                     </div>
                  </FieldGroup>
               </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* ── Section 3: Variantes ── */}
            <Collapsible defaultOpen={!isCreate && (existingVariants ?? []).length > 0}>
               <div className="flex items-center justify-between">
                  <SectionTrigger>Variantes</SectionTrigger>
                  <form.Field mode="array" name="variants">
                     {(field) => (
                        <Button
                           className="h-7 text-xs"
                           onClick={() =>
                              field.pushValue({
                                 name: "",
                                 basePrice: form.getFieldValue("basePrice"),
                                 billingCycle: "monthly",
                              })
                           }
                           size="sm"
                           type="button"
                           variant="outline"
                        >
                           <PlusCircle className="size-3.5 mr-1" />
                           Adicionar
                        </Button>
                     )}
                  </form.Field>
               </div>
               <CollapsibleContent>
                  <div className="space-y-3 pt-2">
                     {/* Existing variants (edit mode) */}
                     {!isCreate &&
                        existingVariants &&
                        existingVariants.length > 0 && (
                           <div className="space-y-1.5">
                              <span className="text-xs text-muted-foreground">
                                 Variantes existentes
                              </span>
                              {existingVariants.map((v) => (
                                 <div
                                    className="flex items-center justify-between p-2 border rounded-md text-sm"
                                    key={v.id}
                                 >
                                    <span>{v.name}</span>
                                    <span className="text-muted-foreground text-xs">
                                       {BILLING_CYCLE_LABELS[
                                          v.billingCycle as BillingCycle
                                       ] ?? v.billingCycle}
                                    </span>
                                 </div>
                              ))}
                           </div>
                        )}

                     {/* New variants */}
                     <form.Field mode="array" name="variants">
                        {(arrayField) => (
                           <div className="space-y-3">
                              {arrayField.state.value.map((_, index) => (
                                 <div
                                    className="flex flex-col gap-2 p-3 border rounded-md bg-muted/30"
                                    key={`variant-${index + 1}`}
                                 >
                                    <div className="flex items-center justify-between">
                                       <span className="text-xs text-muted-foreground font-medium">
                                          Nova variante {index + 1}
                                       </span>
                                       <Button
                                          className="h-6 w-6"
                                          onClick={() =>
                                             arrayField.removeValue(index)
                                          }
                                          aria-label="Remover variante"
                                          size="icon"
                                          type="button"
                                          variant="ghost"
                                       >
                                          <Trash2 className="size-3.5 text-destructive" />
                                       </Button>
                                    </div>

                                    {/* Variant name */}
                                    <form.Field
                                       name={`variants[${index}].name`}
                                    >
                                       {(field) => (
                                          <Field>
                                             <FieldLabel>Nome</FieldLabel>
                                             <Input
                                                onBlur={field.handleBlur}
                                                onChange={(e) =>
                                                   field.handleChange(
                                                      e.target.value,
                                                   )
                                                }
                                                placeholder="Ex: Mensal Básico"
                                                value={
                                                   field.state.value as string
                                                }
                                             />
                                          </Field>
                                       )}
                                    </form.Field>

                                    <div className="grid grid-cols-2 gap-2">
                                       {/* Base price */}
                                       <form.Field
                                          name={`variants[${index}].basePrice`}
                                       >
                                          {(field) => (
                                             <Field>
                                                <FieldLabel>Preço</FieldLabel>
                                                <MoneyInput
                                                   onChange={(v) =>
                                                      field.handleChange(
                                                         v ?? 0,
                                                      )
                                                   }
                                                   value={
                                                      field.state
                                                         .value as number
                                                   }
                                                   valueInCents={true}
                                                />
                                             </Field>
                                          )}
                                       </form.Field>

                                       {/* Billing cycle */}
                                       <form.Field
                                          name={`variants[${index}].billingCycle`}
                                       >
                                          {(field) => (
                                             <Field>
                                                <FieldLabel>Ciclo</FieldLabel>
                                                <Select
                                                   onValueChange={(v) =>
                                                      field.handleChange(
                                                         v as BillingCycle,
                                                      )
                                                   }
                                                   value={
                                                      field.state
                                                         .value as string
                                                   }
                                                >
                                                   <SelectTrigger>
                                                      <SelectValue placeholder="Ciclo" />
                                                   </SelectTrigger>
                                                   <SelectContent>
                                                      {BILLING_CYCLE_OPTIONS.map(
                                                         (cycle) => (
                                                            <SelectItem
                                                               key={cycle}
                                                               value={cycle}
                                                            >
                                                               {
                                                                  BILLING_CYCLE_LABELS[
                                                                     cycle
                                                                  ]
                                                               }
                                                            </SelectItem>
                                                         ),
                                                      )}
                                                   </SelectContent>
                                                </Select>
                                             </Field>
                                          )}
                                       </form.Field>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </form.Field>
                  </div>
               </CollapsibleContent>
            </Collapsible>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        isPending ||
                        mutationsPending
                     }
                     type="submit"
                  >
                     {(state.isSubmitting || isPending || mutationsPending) && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     {isCreate ? "Criar serviço" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
