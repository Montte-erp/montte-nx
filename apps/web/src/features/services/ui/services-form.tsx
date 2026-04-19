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
   useMutation,
   useSuspenseQueries,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { PlusCircle, Trash2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
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

function ExistingVariants({ serviceId }: { serviceId: string }) {
   const { data } = useSuspenseQuery(
      orpc.services.getVariants.queryOptions({ input: { serviceId } }),
   );
   if (!data || data.length === 0) return null;
   return (
      <div className="flex flex-col gap-2">
         <span className="text-xs text-muted-foreground">
            Variantes existentes
         </span>
         {data.map((v) => (
            <div
               className="flex items-center justify-between p-2 border rounded-md text-sm"
               key={v.id}
            >
               <span>{v.name}</span>
               <span className="text-muted-foreground text-xs">
                  {BILLING_CYCLE_LABELS[v.billingCycle as BillingCycle] ??
                     v.billingCycle}
               </span>
            </div>
         ))}
      </div>
   );
}

export function ServiceForm({ mode, service, onSuccess }: ServiceFormProps) {
   const isCreate = mode === "create";

   const [{ data: categories }, { data: tagsResult }] = useSuspenseQueries({
      queries: [
         orpc.categories.getAll.queryOptions({}),
         orpc.tags.getAll.queryOptions({}),
      ],
   });
   const tags = tagsResult.data;

   const { openAlertDialog } = useAlertDialog();

   const createMutation = useMutation(orpc.services.create.mutationOptions());
   const updateMutation = useMutation(orpc.services.update.mutationOptions());
   const createVariantMutation = useMutation(
      orpc.services.createVariant.mutationOptions(),
   );

   const emptyVariants: VariantFormValue[] = [];

   const form = useForm({
      defaultValues: {
         name: service?.name ?? "",
         description: service?.description ?? "",
         basePrice: service?.basePrice ?? "0",
         categoryId: service?.categoryId ?? "",
         tagId: service?.tagId ?? "",
         variants: emptyVariants,
      },
      validators: {
         onSubmitAsync: async ({ value }) => {
            const categoryId = value.categoryId.trim() || undefined;
            const tagId = value.tagId.trim() || undefined;

            if (isCreate) {
               const createResult = await fromPromise(
                  createMutation.mutateAsync({
                     name: value.name.trim(),
                     description: value.description.trim() || undefined,
                     basePrice: value.basePrice,
                     categoryId,
                     tagId,
                  }),
                  (e) => e,
               );
               if (createResult.isErr()) {
                  const err = createResult.error;
                  return err instanceof Error
                     ? err.message
                     : "Erro inesperado.";
               }
               if (value.variants.length > 0) {
                  const results = await Promise.allSettled(
                     value.variants.map((v) =>
                        createVariantMutation.mutateAsync({
                           serviceId: createResult.value.id,
                           name: v.name.trim(),
                           basePrice: v.basePrice,
                           billingCycle: v.billingCycle,
                        }),
                     ),
                  );
                  const failed = results.filter(
                     (r) => r.status === "rejected",
                  ).length;
                  if (failed > 0) {
                     toast.warning(
                        `Serviço criado, mas ${failed} variante(s) falharam.`,
                     );
                  } else {
                     toast.success("Serviço criado.");
                  }
               } else {
                  toast.success("Serviço criado.");
               }
            } else if (service) {
               const updateResult = await fromPromise(
                  updateMutation.mutateAsync({
                     id: service.id,
                     name: value.name.trim(),
                     description: value.description.trim() || undefined,
                     basePrice: value.basePrice,
                     categoryId,
                     tagId,
                  }),
                  (e) => e,
               );
               if (updateResult.isErr()) {
                  const err = updateResult.error;
                  return err instanceof Error
                     ? err.message
                     : "Erro inesperado.";
               }
               toast.success("Serviço atualizado.");
            }
            onSuccess();
            return null;
         },
      },
   });

   const blocker = useBlocker({
      withResolver: true,
      shouldBlockFn: () => {
         if (form.store.state.isDirty && !form.store.state.isSubmitted) {
            openAlertDialog({
               title: "Descartar alterações?",
               description:
                  "Você tem alterações não salvas. Tem certeza que deseja sair sem salvar?",
               actionLabel: "Descartar alterações",
               cancelLabel: "Continuar editando",
               onAction: () => blocker.proceed?.(),
               onCancel: () => blocker.reset?.(),
            });
            return true;
         }
         return false;
      },
      disabled: isCreate,
   });

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
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

               {!isCreate && service?.id && (
                  <QueryBoundary
                     errorTitle="Erro ao carregar variantes"
                     fallback={null}
                  >
                     <ExistingVariants serviceId={service.id} />
                  </QueryBoundary>
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

         <CredenzaFooter className="flex flex-col gap-2">
            <form.Subscribe
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     className="w-full gap-2"
                     disabled={!canSubmit || isSubmitting}
                     type="submit"
                  >
                     {isSubmitting && <Spinner className="size-4" />}
                     {isCreate ? "Criar serviço" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
