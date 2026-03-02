import { Button } from "@packages/ui/components/button";
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
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { PlusCircle, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { ServiceRow } from "./services-columns";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
// Component
// ---------------------------------------------------------------------------

export function ServiceForm({ mode, service, onSuccess }: ServiceFormProps) {
   const isCreate = mode === "create";
   const [isPending, startTransition] = useTransition();

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
         category: service?.category ?? "",
         variants: [] as VariantFormValue[],
      },
      onSubmit: async ({ value }) => {
         const category = value.category.trim() || undefined;

         if (isCreate) {
            const created = await createMutation.mutateAsync({
               name: value.name.trim(),
               category,
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
               category,
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

         <CredenzaBody className="space-y-4">
            <FieldGroup>
               {/* Name */}
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Nome *</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Plano Mensal"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Category */}
               <form.Field name="category">
                  {(field) => (
                     <Field>
                        <FieldLabel>Categoria</FieldLabel>
                        <Input
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Coworking"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            {/* Variants — create mode only */}
            {isCreate && (
               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium">Variantes</span>
                     <form.Field mode="array" name="variants">
                        {(field) => (
                           <Button
                              onClick={() =>
                                 field.pushValue({
                                    name: "",
                                    basePrice: 0,
                                    billingCycle: "monthly",
                                 })
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                           >
                              <PlusCircle className="size-4 mr-1" />
                              Adicionar
                           </Button>
                        )}
                     </form.Field>
                  </div>

                  <form.Field mode="array" name="variants">
                     {(arrayField) => (
                        <div className="space-y-3">
                           {arrayField.state.value.map((_, index) => (
                              <div
                                 className="flex flex-col gap-2 p-3 border rounded-md"
                                 key={`variant-${index + 1}`}
                              >
                                 <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground font-medium">
                                       Variante {index + 1}
                                    </span>
                                    <Button
                                       onClick={() =>
                                          arrayField.removeValue(index)
                                       }
                                       size="icon"
                                       type="button"
                                       variant="ghost"
                                    >
                                       <Trash2 className="size-4 text-destructive" />
                                       <span className="sr-only">
                                          Remover variante
                                       </span>
                                    </Button>
                                 </div>

                                 {/* Variant name */}
                                 <form.Field name={`variants[${index}].name`}>
                                    {(field) => (
                                       <Field>
                                          <FieldLabel>
                                             Nome da variante
                                          </FieldLabel>
                                          <Input
                                             onBlur={field.handleBlur}
                                             onChange={(e) =>
                                                field.handleChange(
                                                   e.target.value,
                                                )
                                             }
                                             placeholder="Ex: Mensal Básico"
                                             value={field.state.value as string}
                                          />
                                       </Field>
                                    )}
                                 </form.Field>

                                 {/* Base price */}
                                 <form.Field
                                    name={`variants[${index}].basePrice`}
                                 >
                                    {(field) => (
                                       <Field>
                                          <FieldLabel>Preço base</FieldLabel>
                                          <MoneyInput
                                             onChange={(v) =>
                                                field.handleChange(v ?? 0)
                                             }
                                             value={field.state.value as number}
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
                                          <FieldLabel>
                                             Ciclo de cobrança
                                          </FieldLabel>
                                          <Select
                                             onValueChange={(v) =>
                                                field.handleChange(
                                                   v as BillingCycle,
                                                )
                                             }
                                             value={field.state.value as string}
                                          >
                                             <SelectTrigger>
                                                <SelectValue placeholder="Selecione o ciclo" />
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
                           ))}
                        </div>
                     )}
                  </form.Field>
               </div>
            )}
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
