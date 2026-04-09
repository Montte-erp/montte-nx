import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
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
import { Skeleton } from "@packages/ui/components/skeleton";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import dayjs from "dayjs";
import { QueryBoundary } from "@/components/query-boundary";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { BillRow } from "./bills-columns";

interface BillFormProps {
   bill: BillRow;
   onSuccess: () => void;
}

function BillFormInner({ bill, onSuccess }: BillFormProps) {
   const today = dayjs().format("YYYY-MM-DD");

   const [{ data: accounts }, { data: categories }] = useSuspenseQueries({
      queries: [
         orpc.bankAccounts.getAll.queryOptions({}),
         orpc.categories.getAll.queryOptions({}),
      ],
   });

   const updateMutation = useMutation(orpc.bills.update.mutationOptions());

   const form = useForm({
      defaultValues: {
         type: bill.type as "payable" | "receivable",
         name: bill.name ?? "",
         amount: bill.amount ?? "",
         dueDate: bill.dueDate ?? today,
         bankAccountId: bill.bankAccount?.id ?? "",
         categoryId: bill.category?.id ?? "",
         description: "",
      },
      onSubmit: async ({ value }) => {
         try {
            await updateMutation.mutateAsync({
               id: bill.id,
               type: value.type,
               name: value.name.trim(),
               amount: value.amount,
               dueDate: value.dueDate,
               bankAccountId: value.bankAccountId || null,
               categoryId: value.categoryId || null,
               description: value.description?.trim() || null,
            });
            toast.success("Conta atualizada com sucesso.");
            onSuccess();
         } catch (err) {
            toast.error(
               err instanceof Error ? err.message : "Erro ao atualizar conta.",
            );
         }
      },
   });

   const { openAlertDialog } = useAlertDialog();

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
   });

   return (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>Editar Conta</CredenzaTitle>
            <CredenzaDescription>
               Atualize as informações da conta.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="type"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Tipo</FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 if (v === "payable" || v === "receivable") {
                                    field.handleChange(v);
                                 }
                              }}
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="payable">
                                    A Pagar
                                 </SelectItem>
                                 <SelectItem value="receivable">
                                    A Receber
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="name"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Aluguel, Energia Elétrica"
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
                  name="amount"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Valor</FieldLabel>
                        <MoneyInput
                           onChange={(v) =>
                              field.handleChange(
                                 v !== undefined ? String(v / 100) : "",
                              )
                           }
                           value={
                              field.state.value
                                 ? Math.round(Number(field.state.value) * 100)
                                 : 0
                           }
                           valueInCents={true}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               />

               <form.Field
                  name="dueDate"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Data de Vencimento</FieldLabel>
                        <DatePicker
                           date={
                              field.state.value
                                 ? dayjs(field.state.value).toDate()
                                 : undefined
                           }
                           onSelect={(d) =>
                              field.handleChange(
                                 d?.toISOString().substring(0, 10) ?? today,
                              )
                           }
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               />

               {accounts.length > 0 && (
                  <form.Field
                     name="bankAccountId"
                     children={(field) => (
                        <Field>
                           <FieldLabel>Conta Bancária</FieldLabel>
                           <Select
                              onValueChange={field.handleChange}
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="Selecione uma conta (opcional)" />
                              </SelectTrigger>
                              <SelectContent>
                                 {accounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                       {acc.name}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  />
               )}

               <form.Subscribe selector={(s) => s.values.type}>
                  {(billType) => {
                     const categoryType =
                        billType === "receivable" ? "income" : "expense";
                     const filtered = categories.filter(
                        (cat) => cat.type === categoryType,
                     );
                     if (filtered.length === 0) return null;
                     return (
                        <form.Field
                           name="categoryId"
                           children={(field) => (
                              <Field>
                                 <FieldLabel>Categoria</FieldLabel>
                                 <Select
                                    onValueChange={field.handleChange}
                                    value={field.state.value}
                                 >
                                    <SelectTrigger>
                                       <SelectValue placeholder="Selecione uma categoria (opcional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {filtered.map((cat) => (
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
                        />
                     );
                  }}
               </form.Subscribe>

               <form.Field
                  name="description"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Descrição (opcional)
                           </FieldLabel>
                           <Textarea
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Observações sobre esta conta..."
                              rows={2}
                              value={field.state.value}
                           />
                        </Field>
                     );
                  }}
               />
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter className="flex flex-col gap-2">
            <form.Subscribe
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     className="w-full"
                     disabled={!canSubmit}
                     type="submit"
                  >
                     {isSubmitting && <Spinner className="size-4" />}
                     Salvar alterações
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

function BillFormSkeleton() {
   return (
      <div className="flex flex-col gap-4 p-4">
         <Skeleton className="h-4 w-32" />
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-4 w-24" />
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-4 w-28" />
         <Skeleton className="h-10 w-full" />
      </div>
   );
}

export function BillForm(props: BillFormProps) {
   return (
      <QueryBoundary
         fallback={<BillFormSkeleton />}
         errorTitle="Erro ao carregar conta"
      >
         <BillFormInner {...props} />
      </QueryBoundary>
   );
}
