import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
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
import { Combobox } from "@packages/ui/components/combobox";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
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
   SheetClose,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { toast } from "@packages/ui/components/sonner";
import { Textarea } from "@packages/ui/components/textarea";
import { UploadDropzone } from "@packages/ui/components/upload-dropzone";
import { UploadProgress } from "@packages/ui/components/upload-progress";
import { cn } from "@packages/ui/lib/utils";
import { useUploadFiles } from "@better-upload/client";
import imageCompression from "browser-image-compression";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
   CheckIcon,
   ChevronDown,
   ChevronRight,
   ChevronsUpDownIcon,
   FileText,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import * as React from "react";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";

type CategoryNode = Outputs["categories"]["getAll"][number];

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

type TransactionStatus = "paid" | "pending" | "cancelled";
type StatusOption = { value: TransactionStatus; label: string };

const STATUS_OPTIONS: StatusOption[] = [
   { value: "paid", label: "Efetivado" },
   { value: "pending", label: "Pendente" },
   { value: "cancelled", label: "Ignorado" },
];

const ATTACHMENT_MAX_FILES = 5;

function parseStatus(value: string): TransactionStatus | undefined {
   return STATUS_OPTIONS.find((s) => s.value === value)?.value;
}

function extractPublicUrls(metadata: unknown): Record<string, string> {
   if (typeof metadata !== "object" || metadata === null) return {};
   if (!("publicUrls" in metadata)) return {};
   const bag = metadata.publicUrls;
   if (typeof bag !== "object" || bag === null) return {};
   const out: Record<string, string> = {};
   for (const [key, value] of Object.entries(bag)) {
      if (typeof value === "string") out[key] = value;
   }
   return out;
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
      ignored: z.boolean(),
      dueDate: z.string(),
      bankAccountId: z.string(),
      destinationBankAccountId: z.string(),
      categoryId: z.string(),
      contactId: z.string(),
      description: z
         .string()
         .max(500, "Observações deve ter no máximo 500 caracteres."),
      attachments: z
         .array(
            z.object({
               url: z.string(),
               filename: z.string(),
               size: z.number(),
               mimeType: z.string().optional(),
            }),
         )
         .max(
            ATTACHMENT_MAX_FILES,
            `Máximo de ${ATTACHMENT_MAX_FILES} anexos.`,
         ),
   })
   .superRefine((v, ctx) => {
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
   ignored: false,
   dueDate: "",
   bankAccountId: "",
   destinationBankAccountId: "",
   categoryId: "",
   contactId: "",
   description: "",
   attachments: [],
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

async function compressIfImage(files: File[]) {
   return Promise.all(
      files.map((file) =>
         file.type.startsWith("image/")
            ? imageCompression(file, {
                 maxSizeMB: 1,
                 maxWidthOrHeight: 2048,
                 useWebWorker: true,
              })
            : file,
      ),
   );
}

interface CategoryPickerProps {
   categories: CategoryNode[];
   value: string;
   onValueChange: (value: string) => void;
   onBlur?: React.FocusEventHandler<HTMLButtonElement>;
   id?: string;
}

function CategoryPicker({
   categories,
   value,
   onValueChange,
   onBlur,
   id,
}: CategoryPickerProps) {
   const [open, setOpen] = React.useState(false);
   const [search, setSearch] = React.useState("");
   const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

   const { roots, childrenByParent, byId } = React.useMemo(() => {
      const byId = new Map<string, CategoryNode>();
      const childrenByParent = new Map<string, CategoryNode[]>();
      const roots: CategoryNode[] = [];
      for (const c of categories) byId.set(c.id, c);
      for (const c of categories) {
         if (c.parentId) {
            const list = childrenByParent.get(c.parentId) ?? [];
            list.push(c);
            childrenByParent.set(c.parentId, list);
         } else {
            roots.push(c);
         }
      }
      return { roots, childrenByParent, byId };
   }, [categories]);

   const selected = value ? byId.get(value) : undefined;
   const selectedLabel = selected
      ? selected.parentId
         ? `${byId.get(selected.parentId)?.name ?? ""} / ${selected.name}`
         : selected.name
      : null;

   const term = search.trim().toLowerCase();

   const visibleRoots = React.useMemo(() => {
      if (!term) return roots;
      return roots.filter((r) => {
         if (r.name.toLowerCase().includes(term)) return true;
         const kids = childrenByParent.get(r.id) ?? [];
         return kids.some((k) => k.name.toLowerCase().includes(term));
      });
   }, [roots, childrenByParent, term]);

   const isRootExpanded = (rootId: string) =>
      term ? true : expanded.has(rootId);

   const toggleExpanded = (rootId: string) => {
      setExpanded((prev) => {
         const next = new Set(prev);
         if (next.has(rootId)) next.delete(rootId);
         else next.add(rootId);
         return next;
      });
   };

   const handleSelect = (id: string) => {
      onValueChange(id === value ? "" : id);
      setOpen(false);
      setSearch("");
   };

   return (
      <Popover
         onOpenChange={(o) => {
            setOpen(o);
            if (!o) setSearch("");
         }}
         open={open}
      >
         <PopoverTrigger asChild>
            <Button
               aria-expanded={open}
               className="flex truncate items-center gap-2"
               id={id}
               onBlur={onBlur}
               role="combobox"
               variant="outline"
            >
               {selectedLabel ?? "Selecionar categoria..."}
               <ChevronsUpDownIcon className="size-4" />
            </Button>
         </PopoverTrigger>
         <PopoverContent className="p-0">
            <Command shouldFilter={false}>
               <CommandInput
                  onValueChange={setSearch}
                  placeholder="Buscar categoria..."
                  value={search}
               />
               <CommandList>
                  {visibleRoots.length === 0 ? (
                     <CommandEmpty>Nenhuma categoria.</CommandEmpty>
                  ) : null}
                  <CommandGroup>
                     {visibleRoots.map((root) => {
                        const kids = childrenByParent.get(root.id) ?? [];
                        const expandedNow = isRootExpanded(root.id);
                        const visibleKids = term
                           ? kids.filter(
                                (k) =>
                                   k.name.toLowerCase().includes(term) ||
                                   root.name.toLowerCase().includes(term),
                             )
                           : kids;
                        return (
                           <React.Fragment key={root.id}>
                              <CommandItem
                                 value={root.id}
                                 onSelect={() => handleSelect(root.id)}
                                 className="gap-2"
                              >
                                 {kids.length > 0 ? (
                                    <button
                                       aria-label={
                                          expandedNow ? "Recolher" : "Expandir"
                                       }
                                       className="flex size-4 items-center justify-center rounded hover:bg-accent"
                                       onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpanded(root.id);
                                       }}
                                       type="button"
                                    >
                                       <ChevronRight
                                          className={cn(
                                             "size-3 transition-transform",
                                             expandedNow && "rotate-90",
                                          )}
                                       />
                                    </button>
                                 ) : (
                                    <span className="size-4" />
                                 )}
                                 <CheckIcon
                                    className={cn(
                                       "size-4",
                                       value === root.id
                                          ? "opacity-100"
                                          : "opacity-0",
                                    )}
                                 />
                                 <span className="truncate">{root.name}</span>
                              </CommandItem>
                              {expandedNow
                                 ? visibleKids.map((child) => (
                                      <CommandItem
                                         key={child.id}
                                         value={child.id}
                                         onSelect={() => handleSelect(child.id)}
                                         className="gap-2 pl-8"
                                      >
                                         <CheckIcon
                                            className={cn(
                                               "size-4",
                                               value === child.id
                                                  ? "opacity-100"
                                                  : "opacity-0",
                                            )}
                                         />
                                         <span className="truncate">
                                            {child.name}
                                         </span>
                                      </CommandItem>
                                   ))
                                 : null}
                           </React.Fragment>
                        );
                     })}
                  </CommandGroup>
               </CommandList>
            </Command>
         </PopoverContent>
      </Popover>
   );
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
   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const attachments = value.attachments;
         const result = await fromPromise(
            createMutation.mutateAsync({
               type: value.type,
               name: value.name.trim(),
               amount: String(value.amount),
               date: value.date,
               status: value.status,
               ignored: value.ignored,
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

   const upload = useUploadFiles({
      api: "/api/upload",
      route: "transactionAttachment",
      onBeforeUpload: ({ files }) => compressIfImage(files),
      onUploadComplete: ({ files, metadata }) => {
         const publicUrls = extractPublicUrls(metadata);
         const added: {
            url: string;
            filename: string;
            size: number;
            mimeType?: string;
         }[] = [];
         for (const f of files) {
            const url = publicUrls[f.objectInfo.key];
            if (!url) continue;
            added.push({
               url,
               filename: f.name,
               size: f.size,
               mimeType: f.type || undefined,
            });
         }
         if (added.length === 0) return;
         form.setFieldValue("attachments", (prev) => {
            const remaining = Math.max(0, ATTACHMENT_MAX_FILES - prev.length);
            const next = added.slice(0, remaining);
            const skipped = added.length - next.length;
            if (skipped > 0) {
               toast.error(
                  `${skipped} arquivo${skipped === 1 ? "" : "s"} ignorado${skipped === 1 ? "" : "s"}: limite de ${ATTACHMENT_MAX_FILES} anexos.`,
               );
            }
            return [...prev, ...next];
         });
      },
      onUploadFail: ({ failedFiles }) => {
         for (const f of failedFiles) {
            toast.error(`${f.name}: ${f.error.message}`);
         }
      },
      onError: (error) => toast.error(error.message),
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
                     <FieldLabel htmlFor={field.name} required>
                        Tipo
                     </FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) => {
                           const parsed = parseTransactionType(v);
                           if (!parsed) return;
                           field.handleChange(parsed);
                           form.setFieldValue("categoryId", "");
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
                  const filteredCategories = categoriesResult.filter((c) =>
                     type === "transfer"
                        ? false
                        : type === "income"
                          ? c.type === "income"
                          : c.type === "expense",
                  );
                  return (
                     <div className="flex flex-col gap-4">
                        <form.Field name="bankAccountId">
                           {(field) => (
                              <Field
                                 data-invalid={
                                    isFieldInvalid(field) || undefined
                                 }
                              >
                                 <FieldLabel htmlFor={field.name} required>
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
                                    <FieldLabel htmlFor={field.name} required>
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
                                    <CategoryPicker
                                       categories={filteredCategories}
                                       id={field.name}
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
                        <FieldLabel htmlFor={field.name} required>
                           Data
                        </FieldLabel>
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
                        <FieldLabel htmlFor={field.name} required>
                           Valor
                        </FieldLabel>
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
                     <FieldLabel htmlFor={field.name} required>
                        Nome
                     </FieldLabel>
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

            <Collapsible>
               <CollapsibleTrigger asChild>
                  <Button
                     className="w-full justify-between [&[data-state=open]>svg]:rotate-180"
                     type="button"
                     variant="ghost"
                  >
                     Mais opções
                     <ChevronDown className="size-4 transition-transform" />
                  </Button>
               </CollapsibleTrigger>
               <CollapsibleContent className="flex flex-col gap-4 pt-4">
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

                  <form.Field name="ignored">
                     {(field) => (
                        <Field className="flex flex-row items-center gap-2 rounded-md border p-4">
                           <Checkbox
                              aria-invalid={isFieldInvalid(field)}
                              checked={field.state.value}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onCheckedChange={(checked) =>
                                 field.handleChange(checked === true)
                              }
                           />
                           <FieldLabel htmlFor={field.name}>
                              Ignorar lançamento
                           </FieldLabel>
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

                  <form.Field name="attachments">
                     {(field) => (
                        <Field>
                           <FieldLabel>Anexos</FieldLabel>
                           <UploadDropzone
                              accept="image/*,application/pdf"
                              control={upload.control}
                              description={{
                                 maxFiles: ATTACHMENT_MAX_FILES,
                                 maxFileSize: "10MB",
                                 fileTypes: "imagens e PDF",
                              }}
                           />
                           {field.state.value.length > 0 ? (
                              <div className="grid grid-cols-3 gap-2">
                                 {field.state.value.map((a, index) => (
                                    <div
                                       key={`${a.url}-${index}`}
                                       className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                                    >
                                       {a.mimeType?.startsWith("image/") ? (
                                          <img
                                             alt={a.filename}
                                             className="size-full object-cover"
                                             src={a.url}
                                          />
                                       ) : (
                                          <div className="flex size-full flex-col items-center justify-center gap-2 p-2 text-muted-foreground">
                                             <FileText className="size-6" />
                                             <span className="line-clamp-2 text-center text-xs">
                                                {a.filename}
                                             </span>
                                          </div>
                                       )}
                                    </div>
                                 ))}
                              </div>
                           ) : null}
                           <UploadProgress control={upload.control} />
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
                        !canSubmit || isSubmitting || upload.control.isPending
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
