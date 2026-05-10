import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { Combobox } from "@packages/ui/components/combobox";
import { DatePicker } from "@packages/ui/components/date-picker";
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
import {
   SheetClose,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { toast } from "@packages/ui/components/sonner";
import { Textarea } from "@packages/ui/components/textarea";
import { uploadFile } from "@better-upload/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ChevronDown } from "lucide-react";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";

const TRANSACTION_TYPES = ["income", "expense", "transfer"] as const;
type TransactionType = (typeof TRANSACTION_TYPES)[number];

function parseTransactionType(value: string): TransactionType | undefined {
   return TRANSACTION_TYPES.find((t) => t === value);
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
   { value: "expense", label: "Despesa" },
   { value: "income", label: "Receita" },
   { value: "transfer", label: "Transferência" },
];

const STATUS_OPTIONS = [
   { value: "paid" as const, label: "Efetivado" },
   { value: "pending" as const, label: "Pendente" },
   { value: "cancelled" as const, label: "Cancelado" },
];

const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = ["application/pdf"] as const;

function parseStatus(
   value: string,
): "pending" | "paid" | "cancelled" | undefined {
   return STATUS_OPTIONS.find((s) => s.value === value)?.value;
}

function extractPublicUrl(metadata: unknown): string | null {
   if (typeof metadata !== "object" || metadata === null) return null;
   if (!("publicUrl" in metadata)) return null;
   const url = metadata.publicUrl;
   return typeof url === "string" ? url : null;
}

const formSchema = z
   .object({
      type: z.enum(TRANSACTION_TYPES),
      name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres."),
      amount: z
         .number({ message: "Valor é obrigatório." })
         .positive("Valor deve ser maior que zero."),
      date: z.string().min(1, "Data é obrigatória."),
      status: z.enum(["pending", "paid", "cancelled"]),
      dueDate: z.string(),
      bankAccountId: z.string(),
      destinationBankAccountId: z.string(),
      categoryId: z.string(),
      contactId: z.string(),
      description: z
         .string()
         .max(500, "Observações deve ter no máximo 500 caracteres."),
      attachment: z.custom<File | null>(),
   })
   .superRefine((v, ctx) => {
      if (v.attachment && v.attachment.size > ATTACHMENT_MAX_SIZE) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["attachment"],
            message: "Comprovante deve ter no máximo 10MB.",
         });
      }
      if (
         v.attachment &&
         !v.attachment.type.startsWith("image/") &&
         !ATTACHMENT_TYPES.some((type) => type === v.attachment?.type)
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["attachment"],
            message: "Comprovante deve ser imagem ou PDF.",
         });
      }
      if (v.type === "transfer") {
         if (!v.bankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["bankAccountId"],
               message: "Transferências exigem uma conta de origem.",
            });
         }
         if (!v.destinationBankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["destinationBankAccountId"],
               message: "Transferências exigem uma conta de destino.",
            });
         }
         if (
            v.bankAccountId &&
            v.destinationBankAccountId &&
            v.bankAccountId === v.destinationBankAccountId
         ) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["destinationBankAccountId"],
               message: "Conta de origem e destino devem ser diferentes.",
            });
         }
      }
      if (v.type === "expense") {
         if (!v.bankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["bankAccountId"],
               message: "Despesas exigem uma conta bancária.",
            });
         }
      }
      if (v.type === "income") {
         if (!v.bankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["bankAccountId"],
               message: "Receitas exigem uma conta bancária.",
            });
         }
      }
   });

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   type: "expense",
   name: "",
   amount: 0,
   date: dayjs().format("YYYY-MM-DD"),
   status: "paid",
   dueDate: "",
   bankAccountId: "",
   destinationBankAccountId: "",
   categoryId: "",
   contactId: "",
   description: "",
   attachment: null,
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

function uploadErrorMessage(error: unknown) {
   if (error instanceof Error) return error.message;
   if (typeof error === "object" && error && "message" in error) {
      const message = error.message;
      if (typeof message === "string") return message;
   }
   return "Falha ao enviar comprovante.";
}

function useTransactionAttachmentUpload() {
   return useMutation({
      mutationFn: (file: File) =>
         uploadFile({
            api: "/api/upload",
            route: "transactionAttachment",
            file,
         }),
      onError: (error) => toast.error(uploadErrorMessage(error)),
   });
}

export function TransactionFormSheet() {
   return (
      <QueryBoundary
         fallback={
            <div className="flex flex-col gap-4 p-4">
               <SheetHeader>
                  <SheetTitle>Novo lançamento</SheetTitle>
                  <SheetDescription>Carregando dados...</SheetDescription>
               </SheetHeader>
            </div>
         }
         errorTitle="Erro ao carregar dados"
      >
         <TransactionFormSheetContent />
      </QueryBoundary>
   );
}

function TransactionFormSheetContent() {
   const { closeTopSheet } = useSheet();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({}),
   );

   const bankOptions = bankAccounts.map((b) => ({
      value: b.id,
      label: b.name,
   }));
   const contactOptions = contacts.map((c) => ({ value: c.id, label: c.name }));

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         onSuccess: () => {
            toast.success("Lançamento criado com sucesso.");
            closeTopSheet();
         },
         onError: (e) => toast.error(e.message),
      }),
   );
   const attachmentUpload = useTransactionAttachmentUpload();

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const attachmentResult = value.attachment
            ? await fromPromise(
                 attachmentUpload.mutateAsync(value.attachment),
                 uploadErrorMessage,
              )
            : null;
         if (attachmentResult?.isErr()) {
            toast.error(attachmentResult.error);
            return;
         }
         const uploadedAttachment =
            attachmentResult?.isOk() === true ? attachmentResult.value : null;
         const attachmentUrl = uploadedAttachment
            ? extractPublicUrl(uploadedAttachment.metadata)
            : null;
         if (uploadedAttachment && !attachmentUrl) {
            toast.error("Falha ao enviar comprovante.");
            return;
         }
         const attachments =
            uploadedAttachment && attachmentUrl
               ? [
                    {
                       url: attachmentUrl,
                       filename: uploadedAttachment.file.name,
                       size: uploadedAttachment.file.size,
                       mimeType: uploadedAttachment.file.type || undefined,
                    },
                 ]
               : [];
         const result = await fromPromise(
            createMutation.mutateAsync({
               type: value.type,
               name: value.name.trim(),
               amount: String(value.amount),
               date: value.date,
               status: value.status,
               dueDate: value.dueDate || null,
               bankAccountId: value.bankAccountId || null,
               destinationBankAccountId:
                  value.type === "transfer"
                     ? value.destinationBankAccountId || null
                     : null,
               categoryId:
                  value.type === "transfer" ? null : value.categoryId || null,
               contactId: value.contactId || null,
               attachments,
               description: value.description.trim() || null,
               paymentMethod: null,
            }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo lançamento</SheetTitle>
            <SheetDescription>
               Registre uma receita, despesa ou transferência.
            </SheetDescription>
         </SheetHeader>

         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(e) => {
               e.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field name="type">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) => {
                           const parsed = parseTransactionType(v);
                           if (!parsed) return;
                           field.handleChange(parsed);
                        }}
                     >
                        <SelectTrigger id={field.name} name={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                 {o.label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values.type}>
               {(type) => {
                  const categoryOptions = categoriesResult
                     .filter((c) =>
                        type === "transfer"
                           ? false
                           : type === "income"
                             ? c.type === "income"
                             : c.type === "expense",
                     )
                     .map((c) => ({ value: c.id, label: c.name }));
                  return (
                     <div className="flex flex-col gap-4">
                        <form.Field name="bankAccountId">
                           {(field) => (
                              <Field
                                 data-invalid={
                                    isFieldInvalid(field) || undefined
                                 }
                              >
                                 <FieldLabel htmlFor={field.name}>
                                    {type === "transfer"
                                       ? "Conta de origem"
                                       : "Conta bancária"}
                                 </FieldLabel>
                                 <Combobox
                                    emptyMessage="Nenhuma conta."
                                    id={field.name}
                                    options={bankOptions}
                                    placeholder="Selecionar conta..."
                                    searchPlaceholder="Buscar conta..."
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onValueChange={(v) => field.handleChange(v)}
                                 />
                                 {isFieldInvalid(field) ? (
                                    <FieldError>
                                       {field.state.meta.errors[0]?.message}
                                    </FieldError>
                                 ) : null}
                              </Field>
                           )}
                        </form.Field>

                        {type === "transfer" ? (
                           <form.Field name="destinationBankAccountId">
                              {(field) => (
                                 <Field
                                    data-invalid={
                                       isFieldInvalid(field) || undefined
                                    }
                                 >
                                    <FieldLabel htmlFor={field.name}>
                                       Conta de destino
                                    </FieldLabel>
                                    <Combobox
                                       emptyMessage="Nenhuma conta."
                                       id={field.name}
                                       options={bankOptions}
                                       placeholder="Selecionar conta..."
                                       searchPlaceholder="Buscar conta..."
                                       value={field.state.value}
                                       onBlur={field.handleBlur}
                                       onValueChange={(v) =>
                                          field.handleChange(v)
                                       }
                                    />
                                    {isFieldInvalid(field) ? (
                                       <FieldError>
                                          {field.state.meta.errors[0]?.message}
                                       </FieldError>
                                    ) : null}
                                 </Field>
                              )}
                           </form.Field>
                        ) : null}

                        {type !== "transfer" ? (
                           <form.Field name="categoryId">
                              {(field) => (
                                 <Field>
                                    <FieldLabel htmlFor={field.name}>
                                       Categoria
                                    </FieldLabel>
                                    <Combobox
                                       emptyMessage="Nenhuma categoria."
                                       id={field.name}
                                       options={categoryOptions}
                                       placeholder="Selecionar categoria..."
                                       searchPlaceholder="Buscar categoria..."
                                       value={field.state.value}
                                       onBlur={field.handleBlur}
                                       onValueChange={(v) =>
                                          field.handleChange(v)
                                       }
                                    />
                                 </Field>
                              )}
                           </form.Field>
                        ) : null}
                     </div>
                  );
               }}
            </form.Subscribe>

            <form.Field name="contactId">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Contato</FieldLabel>
                     <Combobox
                        emptyMessage="Nenhum contato."
                        id={field.name}
                        options={contactOptions}
                        placeholder="Selecionar contato..."
                        searchPlaceholder="Buscar contato..."
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onValueChange={(v) => field.handleChange(v)}
                     />
                  </Field>
               )}
            </form.Field>

            <div className="grid grid-cols-2 gap-4">
               <form.Field name="date">
                  {(field) => (
                     <Field data-invalid={isFieldInvalid(field) || undefined}>
                        <FieldLabel htmlFor={field.name}>Data</FieldLabel>
                        <DatePicker
                           className="w-full overflow-hidden [&>span]:truncate"
                           date={
                              field.state.value
                                 ? dayjs(field.state.value).toDate()
                                 : undefined
                           }
                           placeholder="Selecionar"
                           onSelect={(d) =>
                              field.handleChange(
                                 d ? dayjs(d).format("YYYY-MM-DD") : "",
                              )
                           }
                        />
                        {isFieldInvalid(field) ? (
                           <FieldError>
                              {field.state.meta.errors[0]?.message}
                           </FieldError>
                        ) : null}
                     </Field>
                  )}
               </form.Field>

               <form.Field name="amount">
                  {(field) => (
                     <Field data-invalid={isFieldInvalid(field) || undefined}>
                        <FieldLabel htmlFor={field.name}>Valor</FieldLabel>
                        <MoneyInput
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           name={field.name}
                           value={field.state.value}
                           valueInCents={false}
                           onBlur={field.handleBlur}
                           onChange={(v) => field.handleChange(v ?? 0)}
                        />
                        {isFieldInvalid(field) ? (
                           <FieldError>
                              {field.state.meta.errors[0]?.message}
                           </FieldError>
                        ) : null}
                     </Field>
                  )}
               </form.Field>
            </div>

            <form.Field name="dueDate">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Vencimento</FieldLabel>
                     <DatePicker
                        className="w-full overflow-hidden [&>span]:truncate"
                        date={
                           field.state.value
                              ? dayjs(field.state.value).toDate()
                              : undefined
                        }
                        placeholder="Selecionar"
                        onSelect={(d) =>
                           field.handleChange(
                              d ? dayjs(d).format("YYYY-MM-DD") : "",
                           )
                        }
                     />
                  </Field>
               )}
            </form.Field>

            <form.Field name="name">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder="Ex.: Aluguel de maio"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {field.state.meta.errors[0]?.message}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <Collapsible className="flex flex-col gap-4">
               <CollapsibleTrigger asChild>
                  <Button
                     className="justify-between px-4"
                     type="button"
                     variant="outline"
                  >
                     Mais detalhes
                     <ChevronDown className="size-4" />
                  </Button>
               </CollapsibleTrigger>
               <CollapsibleContent className="flex flex-col gap-4">
                  <form.Field name="status">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                           <Select
                              value={field.state.value}
                              onValueChange={(v) => {
                                 const parsed = parseStatus(v);
                                 if (!parsed) return;
                                 field.handleChange(parsed);
                              }}
                           >
                              <SelectTrigger id={field.name} name={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                       {o.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="description">
                     {(field) => (
                        <Field
                           data-invalid={isFieldInvalid(field) || undefined}
                        >
                           <FieldLabel htmlFor={field.name}>
                              Observações
                           </FieldLabel>
                           <Textarea
                              aria-invalid={isFieldInvalid(field)}
                              id={field.name}
                              name={field.name}
                              placeholder="Observações sobre o lançamento"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                           />
                           {isFieldInvalid(field) ? (
                              <FieldError>
                                 {field.state.meta.errors[0]?.message}
                              </FieldError>
                           ) : null}
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="attachment">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Comprovante
                           </FieldLabel>
                           <Input
                              accept="image/*,application/pdf"
                              aria-invalid={isFieldInvalid(field)}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.files?.[0] ?? null)
                              }
                              type="file"
                           />
                           {isFieldInvalid(field) ? (
                              <FieldError>
                                 {field.state.meta.errors[0]?.message}
                              </FieldError>
                           ) : null}
                        </Field>
                     )}
                  </form.Field>
               </CollapsibleContent>
            </Collapsible>
         </form>

         <SheetFooter>
            <SheetClose asChild>
               <Button variant="outline">Cancelar</Button>
            </SheetClose>
            <form.Subscribe
               selector={(s) => ({
                  canSubmit: s.canSubmit,
                  isSubmitting: s.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={
                        !canSubmit || isSubmitting || attachmentUpload.isPending
                     }
                     onClick={() => form.handleSubmit()}
                  >
                     Criar lançamento
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
