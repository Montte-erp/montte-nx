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
import { Spinner } from "@packages/ui/components/spinner";
import { Switch } from "@packages/ui/components/switch";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { BillInstallmentPreview } from "./bill-installment-preview";
import type { BillRow } from "./bills-columns";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQUENCY_OPTIONS = [
   { value: "weekly", label: "Semanal" },
   { value: "biweekly", label: "Quinzenal" },
   { value: "monthly", label: "Mensal" },
   { value: "quarterly", label: "Trimestral" },
   { value: "yearly", label: "Anual" },
] as const;

const SPLIT_MODE_OPTIONS = [
   { value: "equal", label: "Dividido igualmente" },
   { value: "fixed", label: "Valor fixo por parcela" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SplitMode = "equal" | "fixed";
type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

interface BillFormProps {
   mode: "create" | "edit";
   defaultType?: "payable" | "receivable";
   bill?: BillRow;
   onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addMonths(dateStr: string, months: number): string {
   const d = new Date(`${dateStr}T00:00:00`);
   d.setMonth(d.getMonth() + months);
   return d.toISOString().substring(0, 10);
}

function buildInstallmentItems(
   amount: string,
   count: number,
   splitMode: SplitMode,
   dueDate: string,
) {
   if (!amount || !count || count < 2 || !dueDate) return [];

   const totalAmount = Number(amount);
   if (Number.isNaN(totalAmount) || totalAmount <= 0) return [];

   return Array.from({ length: count }, (_, i) => {
      const itemAmount =
         splitMode === "equal"
            ? (totalAmount / count).toFixed(2)
            : String(totalAmount);
      return {
         index: i + 1,
         dueDate: addMonths(dueDate, i),
         amount: itemAmount,
      };
   });
}

// ---------------------------------------------------------------------------
// Inner component (reads suspense data)
// ---------------------------------------------------------------------------

function BillFormInner({ mode, defaultType, bill, onSuccess }: BillFormProps) {
   const isCreate = mode === "create";
   const today = new Date().toISOString().substring(0, 10);

   // Installment / recurrence toggles (create only)
   const [isInstallment, setIsInstallment] = useState(false);
   const [isRecurring, setIsRecurring] = useState(false);
   const [splitMode, setSplitMode] = useState<SplitMode>("equal");

   const { data: accounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.bills.create.mutationOptions({
         onSuccess: () => {
            toast.success("Conta criada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar conta.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.bills.update.mutationOptions({
         onSuccess: () => {
            toast.success("Conta atualizada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar conta.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         type:
            bill?.type ??
            defaultType ??
            ("payable" as "payable" | "receivable"),
         name: bill?.name ?? "",
         amount: bill?.amount ?? "",
         dueDate: bill?.dueDate ?? today,
         bankAccountId: bill?.bankAccount?.id ?? "",
         categoryId: bill?.category?.id ?? "",
         description: "",
         // Installment fields
         installmentCount: 2,
         // Recurrence fields
         frequency: "monthly" as Frequency,
         windowMonths: 3,
         recurrenceEndsAt: "",
      },
      onSubmit: async ({ value }) => {
         const billBase = {
            type: value.type,
            name: value.name.trim(),
            amount: value.amount,
            dueDate: value.dueDate,
            bankAccountId: value.bankAccountId || null,
            categoryId: value.categoryId || null,
            description: value.description?.trim() || null,
         };

         if (isCreate) {
            await createMutation.mutateAsync({
               bill: billBase,
               installment: isInstallment
                  ? {
                       mode: splitMode,
                       count: value.installmentCount,
                    }
                  : undefined,
               recurrence: isRecurring
                  ? {
                       frequency: value.frequency,
                       windowMonths: value.windowMonths,
                       endsAt: value.recurrenceEndsAt || null,
                    }
                  : undefined,
            });
         } else if (bill) {
            await updateMutation.mutateAsync({
               id: bill.id,
               ...billBase,
            });
         }
      },
   });

   // Live installment preview data
   const formValues = useStore(form.baseStore, (s) => s.values);
   const previewItems = buildInstallmentItems(
      formValues.amount,
      formValues.installmentCount,
      splitMode,
      formValues.dueDate,
   );

   const isPending = createMutation.isPending || updateMutation.isPending;

   return (
      <form
         className="h-full flex flex-col"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Nova Conta" : "Editar Conta"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Adicione uma nova conta a pagar ou receber."
                  : "Atualize as informações da conta."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            <FieldGroup>
               {/* Type */}
               <form.Field name="type">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Tipo</FieldLabel>
                           <Select
                              onValueChange={(v) =>
                                 field.handleChange(
                                    v as "payable" | "receivable",
                                 )
                              }
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
               </form.Field>

               {/* Name */}
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Nome</FieldLabel>
                           <Input
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
               </form.Field>

               {/* Amount */}
               <form.Field name="amount">
                  {(field) => (
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
               </form.Field>

               {/* Due Date */}
               <form.Field name="dueDate">
                  {(field) => (
                     <Field>
                        <FieldLabel>Data de Vencimento</FieldLabel>
                        <DatePicker
                           date={
                              field.state.value
                                 ? new Date(`${field.state.value}T00:00:00`)
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
               </form.Field>

               {/* Bank Account */}
               {accounts.length > 0 && (
                  <form.Field name="bankAccountId">
                     {(field) => (
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
                  </form.Field>
               )}

               {/* Category */}
               {categories.length > 0 && (
                  <form.Field name="categoryId">
                     {(field) => (
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
                                 {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                       {cat.name}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
               )}

               {/* Description */}
               <form.Field name="description">
                  {(field) => (
                     <Field>
                        <FieldLabel>Descrição (opcional)</FieldLabel>
                        <Textarea
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Observações sobre esta conta..."
                           rows={2}
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            {/* ----------------------------------------------------------- */}
            {/* Installment section — create only                            */}
            {/* ----------------------------------------------------------- */}
            {isCreate && (
               <div className="space-y-3">
                  <div className="flex items-center gap-3">
                     <Switch
                        checked={isInstallment}
                        onCheckedChange={(v) => {
                           setIsInstallment(v);
                           if (v) setIsRecurring(false);
                        }}
                     />
                     <span className="text-sm font-medium">Parcelar</span>
                  </div>

                  {isInstallment && (
                     <div className="space-y-3 pl-2 border-l-2 border-muted ml-2">
                        {/* Split mode */}
                        <Field>
                           <FieldLabel>Modo de divisão</FieldLabel>
                           <Select
                              onValueChange={(v) =>
                                 setSplitMode(v as SplitMode)
                              }
                              value={splitMode}
                           >
                              <SelectTrigger>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {SPLIT_MODE_OPTIONS.map((opt) => (
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

                        {/* Installment count */}
                        <form.Field name="installmentCount">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Número de parcelas</FieldLabel>
                                 <Input
                                    min={2}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                       field.handleChange(
                                          Number.parseInt(e.target.value, 10) ||
                                             2,
                                       )
                                    }
                                    type="number"
                                    value={field.state.value}
                                 />
                                 <FieldError errors={field.state.meta.errors} />
                              </Field>
                           )}
                        </form.Field>

                        {/* Live preview */}
                        {previewItems.length > 0 && (
                           <BillInstallmentPreview items={previewItems} />
                        )}
                     </div>
                  )}
               </div>
            )}

            {/* ----------------------------------------------------------- */}
            {/* Recurrence section — create only                             */}
            {/* ----------------------------------------------------------- */}
            {isCreate && (
               <div className="space-y-3">
                  <div className="flex items-center gap-3">
                     <Switch
                        checked={isRecurring}
                        onCheckedChange={(v) => {
                           setIsRecurring(v);
                           if (v) setIsInstallment(false);
                        }}
                     />
                     <span className="text-sm font-medium">Recorrente</span>
                  </div>

                  {isRecurring && (
                     <div className="space-y-3 pl-2 border-l-2 border-muted ml-2">
                        {/* Frequency */}
                        <form.Field name="frequency">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Frequência</FieldLabel>
                                 <Select
                                    onValueChange={(v) =>
                                       field.handleChange(v as Frequency)
                                    }
                                    value={field.state.value}
                                 >
                                    <SelectTrigger>
                                       <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {FREQUENCY_OPTIONS.map((opt) => (
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

                        {/* Window months */}
                        <form.Field name="windowMonths">
                           {(field) => (
                              <Field>
                                 <FieldLabel>
                                    Gerar contas para quantos meses?
                                 </FieldLabel>
                                 <Input
                                    max={12}
                                    min={1}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                       field.handleChange(
                                          Number.parseInt(e.target.value, 10) ||
                                             1,
                                       )
                                    }
                                    type="number"
                                    value={field.state.value}
                                 />
                                 <FieldError errors={field.state.meta.errors} />
                              </Field>
                           )}
                        </form.Field>

                        {/* Recurrence ends at */}
                        <form.Field name="recurrenceEndsAt">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Encerrar em (opcional)</FieldLabel>
                                 <DatePicker
                                    date={
                                       field.state.value
                                          ? new Date(
                                               `${field.state.value}T00:00:00`,
                                            )
                                          : undefined
                                    }
                                    onSelect={(d) =>
                                       field.handleChange(
                                          d?.toISOString().substring(0, 10) ??
                                             "",
                                       )
                                    }
                                 />
                              </Field>
                           )}
                        </form.Field>
                     </div>
                  )}
               </div>
            )}
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit || state.isSubmitting || isPending
                     }
                     type="submit"
                  >
                     {(state.isSubmitting || isPending) && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     {isCreate ? "Criar conta" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

// ---------------------------------------------------------------------------
// Public export (with Suspense boundary)
// ---------------------------------------------------------------------------

export function BillForm(props: BillFormProps) {
   return (
      <Suspense fallback={null}>
         <BillFormInner {...props} />
      </Suspense>
   );
}
