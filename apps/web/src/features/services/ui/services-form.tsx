import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
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
import {
   skipToken,
   useMutation,
   useSuspenseQueries,
} from "@tanstack/react-query";
import { PlusCircle, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { ServiceRow } from "./services-columns";

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

interface VariantFormValue {
   name: string;
   basePrice: string;
   billingCycle: BillingCycle;
}

interface ServiceFormProps {
   mode: "create" | "edit";
   service?: ServiceRow;
   onSuccess: () => void;
}

export function ServiceForm({ mode, service, onSuccess }: ServiceFormProps) {
   const isCreate = mode === "create";
   const [isPending, startTransition] = useTransition();

   const [{ data: categories }, { data: tags }, { data: existingVariants }] =
      useSuspenseQueries({
         queries: [
            orpc.categories.getAll.queryOptions({}),
            orpc.tags.getAll.queryOptions({}),
            !isCreate && service?.id
               ? orpc.services.getVariants.queryOptions({
                    input: { serviceId: service.id },
                 })
               : {
                    queryKey: ["disabled-variants", service?.id],
                    queryFn: skipToken,
                 },
         ],
      });

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
         basePrice: service?.basePrice ?? "0",
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
               categoryId,
               tagId,
            });

            if (value.variants.length > 0) {
               await Promise.all(
                  value.variants.map((v) =>
                     createVariantMutation.mutateAsync({
                        serviceId: created.id,
                        name: v.name.trim(),
                        basePrice: v.basePrice,
                        billingCycle: v.billingCycle as BillingCycle,
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
      <form onSubmit={handleSubmit}>
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Novo Serviço" : "Editar Serviço"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Preencha as informações do serviço e adicione variantes de preço."
                  : "Atualize as informações do serviço."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="px-4">
            <div className="grid grid-cols-2 gap-4">
               <form.Field
                  name="name"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Nome *</FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Consultoria Mensal"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="basePrice"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Preço padrão *</FieldLabel>
                        <MoneyInput
                           onChange={(v) => field.handleChange(String(v ?? 0))}
                           value={Number(field.state.value)}
                        />
                     </Field>
                  )}
               />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <form.Field
                  name="categoryId"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Categoria</FieldLabel>
                        <Select
                           onValueChange={(v) => field.handleChange(v)}
                           value={field.state.value}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Selecione uma categoria" />
                           </SelectTrigger>
                           <SelectContent>
                              {categories?.map((cat) => (
                                 <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  )}
               />

               <form.Field
                  name="tagId"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Tag</FieldLabel>
                        <Select
                           onValueChange={(v) => field.handleChange(v)}
                           value={field.state.value}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Selecione uma tag" />
                           </SelectTrigger>
                           <SelectContent>
                              {tags?.map((tag) => (
                                 <SelectItem key={tag.id} value={tag.id}>
                                    {tag.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  )}
               />
            </div>

            <form.Field
               name="description"
               children={(field) => {
                  const isInvalid =
                     field.state.meta.isTouched &&
                     field.state.meta.errors.length > 0;
                  return (
                     <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                        <Textarea
                           id={field.name}
                           name={field.name}
                           aria-invalid={isInvalid}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Opcional"
                           rows={1}
                           value={field.state.value}
                        />
                     </Field>
                  );
               }}
            />

            <Separator />

            <div className="flex flex-col gap-2">
               <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Variantes</span>
                  <form.Field
                     mode="array"
                     name="variants"
                     children={(field) => (
                        <Button
                           className="h-7 text-xs gap-2"
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
                           <PlusCircle className="size-3.5" />
                           Adicionar
                        </Button>
                     )}
                  />
               </div>

               {!isCreate &&
                  existingVariants &&
                  existingVariants.length > 0 && (
                     <div className="flex flex-col gap-2">
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

               <form.Field
                  mode="array"
                  name="variants"
                  children={(arrayField) => (
                     <div className="flex flex-col gap-2">
                        {arrayField.state.value.map((_, index) => (
                           <div
                              className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end p-3 border rounded-md bg-muted/30"
                              key={`variant-${index + 1}`}
                           >
                              <form.Field
                                 name={`variants[${index}].name`}
                                 children={(field) => {
                                    const isInvalid =
                                       field.state.meta.isTouched &&
                                       field.state.meta.errors.length > 0;
                                    return (
                                       <Field data-invalid={isInvalid}>
                                          <FieldLabel htmlFor={field.name}>
                                             Nome
                                          </FieldLabel>
                                          <Input
                                             id={field.name}
                                             name={field.name}
                                             aria-invalid={isInvalid}
                                             onBlur={field.handleBlur}
                                             onChange={(e) =>
                                                field.handleChange(
                                                   e.target.value,
                                                )
                                             }
                                             placeholder="Ex: Mensal"
                                             value={field.state.value as string}
                                          />
                                       </Field>
                                    );
                                 }}
                              />

                              <form.Field
                                 name={`variants[${index}].basePrice`}
                                 children={(field) => (
                                    <Field>
                                       <FieldLabel>Preço</FieldLabel>
                                       <MoneyInput
                                          onChange={(v) =>
                                             field.handleChange(String(v ?? 0))
                                          }
                                          value={Number(
                                             field.state.value as string,
                                          )}
                                       />
                                    </Field>
                                 )}
                              />

                              <form.Field
                                 name={`variants[${index}].billingCycle`}
                                 children={(field) => (
                                    <Field>
                                       <FieldLabel>Ciclo</FieldLabel>
                                       <Select
                                          onValueChange={(v) =>
                                             field.handleChange(
                                                v as BillingCycle,
                                             )
                                          }
                                          value={field.state.value as string}
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
                              />

                              <Button
                                 aria-label="Remover variante"
                                 className="h-9 w-9"
                                 onClick={() => arrayField.removeValue(index)}
                                 size="icon"
                                 type="button"
                                 variant="ghost"
                              >
                                 <Trash2 className="size-4 text-destructive" />
                              </Button>
                           </div>
                        ))}
                     </div>
                  )}
               />
            </div>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     className="w-full gap-2"
                     disabled={
                        !canSubmit ||
                        isSubmitting ||
                        isPending ||
                        mutationsPending
                     }
                     type="submit"
                  >
                     {(isSubmitting || isPending || mutationsPending) && (
                        <Spinner className="size-4" />
                     )}
                     {isCreate ? "Criar serviço" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
