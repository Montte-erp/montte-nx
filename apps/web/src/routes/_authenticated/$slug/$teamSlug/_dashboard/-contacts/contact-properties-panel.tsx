import {
   ContextPanelHeader,
   ContextPanelHeaderActions,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupButton,
   InputGroupInput,
   InputGroupTextarea,
} from "@packages/ui/components/input-group";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { MaskitoOptions } from "@maskito/core";
import { useMaskito } from "@maskito/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { format, of } from "@f-o-t/money";
import dayjs from "dayjs";
import {
   AlignLeft,
   Calendar,
   Check,
   FileText,
   Info,
   Mail,
   Pencil,
   Phone,
   Tag,
   TrendingDown,
   TrendingUp,
   User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { ContextPanelMeta } from "@/features/context-panel/context-panel-info";
import { useAlertDialog } from "@/hooks/use-alert-dialog";

type Contact = Outputs["contacts"]["getById"];
type FieldKey = "name" | "type" | "email" | "phone" | "document" | "notes";

const TYPE_LABELS: Record<Contact["type"], string> = {
   cliente: "Cliente",
   fornecedor: "Fornecedor",
   ambos: "Ambos",
};

const FIELD_WARNINGS: Record<FieldKey, string> = {
   name: "O nome será refletido em todos os lançamentos vinculados.",
   type: "Alterar o tipo afeta filtros e relatórios vinculados a este contato.",
   email: "Alterar o email pode afetar notificações enviadas a este contato.",
   phone: "Alterar o telefone pode afetar comunicações com este contato.",
   document:
      "Alterar o CPF/CNPJ pode impactar registros fiscais e notas fiscais vinculadas.",
   notes: "Alterar as observações é uma ação permanente.",
};

const FINANCIAL_CONFIG: Record<
   Contact["type"],
   { label: string; tooltip: string }
> = {
   cliente: {
      label: "Recebido",
      tooltip: "Valor total recebido deste cliente.",
   },
   fornecedor: {
      label: "Pago",
      tooltip: "Valor total pago a este fornecedor.",
   },
   ambos: {
      label: "Recebido / Pago",
      tooltip: "Total recebido e pago a este contato.",
   },
};

function SectionHeader({
   title,
   tooltip,
   children,
}: {
   title: string;
   tooltip?: string;
   children?: React.ReactNode;
}) {
   return (
      <ContextPanelHeader>
         <ContextPanelTitle>{title}</ContextPanelTitle>
         {tooltip && (
            <ContextPanelHeaderActions>
               <TooltipProvider>
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Info className="size-3.5 text-muted-foreground" />
                     </TooltipTrigger>
                     <TooltipContent side="left">{tooltip}</TooltipContent>
                  </Tooltip>
               </TooltipProvider>
            </ContextPanelHeaderActions>
         )}
         {children}
      </ContextPanelHeader>
   );
}

function PropRow({
   icon: Icon,
   label,
   value,
   editNode,
   onEdit,
}: {
   icon: LucideIcon;
   label: string;
   value: React.ReactNode;
   editNode?: React.ReactNode;
   onEdit?: () => void;
}) {
   return (
      <Item size="sm" className="group/prop">
         <ItemMedia variant="icon">
            <Icon />
         </ItemMedia>
         <ItemContent>
            <ItemTitle className="text-xs font-normal text-muted-foreground">
               {label}
            </ItemTitle>
            <ItemDescription className="text-xs text-foreground">
               {editNode ?? value}
            </ItemDescription>
         </ItemContent>
         {!editNode && onEdit && (
            <ItemActions>
               <Button
                  aria-label={`Editar ${label}`}
                  className="size-6 opacity-0 transition-opacity group-hover/prop:opacity-100"
                  size="icon"
                  variant="ghost"
                  onClick={onEdit}
               >
                  <Pencil className="size-3" />
               </Button>
            </ItemActions>
         )}
      </Item>
   );
}

function InlineTextField({
   defaultValue,
   inputType = "text",
   onCommit,
   onCancel,
}: {
   defaultValue: string;
   inputType?: "text" | "email";
   onCommit: (value: string) => void;
   onCancel: () => void;
}) {
   const cancelledRef = useRef(false);
   const form = useForm({
      defaultValues: { value: defaultValue },
      onSubmit: ({ value }) => onCommit(value.value),
   });

   return (
      <form.Field name="value">
         {(field) => (
            <InputGroup>
               <InputGroupInput
                  autoFocus
                  aria-label="Editar campo"
                  className="text-xs"
                  id={field.name}
                  name={field.name}
                  type={inputType}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={() => {
                     if (!cancelledRef.current) form.handleSubmit();
                  }}
                  onKeyDown={(e) => {
                     if (e.key === "Enter") form.handleSubmit();
                     if (e.key === "Escape") {
                        cancelledRef.current = true;
                        onCancel();
                     }
                  }}
               />
               <InputGroupAddon align="inline-end">
                  <InputGroupButton
                     aria-label="Salvar"
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => form.handleSubmit()}
                  >
                     <Check />
                  </InputGroupButton>
               </InputGroupAddon>
            </InputGroup>
         )}
      </form.Field>
   );
}

function InlineTextareaField({
   defaultValue,
   onCommit,
   onCancel,
}: {
   defaultValue: string;
   onCommit: (value: string) => void;
   onCancel: () => void;
}) {
   const cancelledRef = useRef(false);
   const form = useForm({
      defaultValues: { value: defaultValue },
      onSubmit: ({ value }) => onCommit(value.value),
   });

   return (
      <form.Field name="value">
         {(field) => (
            <InputGroup>
               <InputGroupTextarea
                  autoFocus
                  aria-label="Editar observações"
                  className="min-h-16 text-xs"
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={() => {
                     if (!cancelledRef.current) form.handleSubmit();
                  }}
                  onKeyDown={(e) => {
                     if (e.key === "Escape") {
                        cancelledRef.current = true;
                        onCancel();
                     }
                     if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                        form.handleSubmit();
                  }}
               />
               <InputGroupAddon align="inline-end">
                  <InputGroupButton
                     aria-label="Salvar"
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => form.handleSubmit()}
                  >
                     <Check />
                  </InputGroupButton>
               </InputGroupAddon>
            </InputGroup>
         )}
      </form.Field>
   );
}

function InlineDocumentField({
   defaultValue,
   inputRef,
   onCommit,
   onCancel,
}: {
   defaultValue: string;
   inputRef: React.RefCallback<HTMLInputElement>;
   onCommit: (value: string) => void;
   onCancel: () => void;
}) {
   const cancelledRef = useRef(false);
   const form = useForm({
      defaultValues: { value: defaultValue },
      onSubmit: ({ value }) => onCommit(value.value),
   });

   return (
      <form.Field name="value">
         {(field) => (
            <InputGroup>
               <InputGroupInput
                  autoFocus
                  ref={inputRef}
                  aria-label="Editar documento"
                  className="font-mono text-xs"
                  id={field.name}
                  key="document-edit"
                  name={field.name}
                  placeholder="CPF ou CNPJ"
                  defaultValue={field.state.value}
                  onInput={(e) =>
                     field.handleChange((e.target as HTMLInputElement).value)
                  }
                  onBlur={() => {
                     if (!cancelledRef.current) form.handleSubmit();
                  }}
                  onKeyDown={(e) => {
                     if (e.key === "Enter") form.handleSubmit();
                     if (e.key === "Escape") {
                        cancelledRef.current = true;
                        onCancel();
                     }
                  }}
               />
               <InputGroupAddon align="inline-end">
                  <InputGroupButton
                     aria-label="Salvar"
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => form.handleSubmit()}
                  >
                     <Check />
                  </InputGroupButton>
               </InputGroupAddon>
            </InputGroup>
         )}
      </form.Field>
   );
}

function InlinePhoneField({
   defaultValue,
   inputRef,
   onCommit,
   onCancel,
}: {
   defaultValue: string;
   inputRef: React.RefCallback<HTMLInputElement>;
   onCommit: (value: string) => void;
   onCancel: () => void;
}) {
   const cancelledRef = useRef(false);
   const form = useForm({
      defaultValues: { value: defaultValue },
      onSubmit: ({ value }) => onCommit(value.value),
   });

   return (
      <form.Field name="value">
         {(field) => (
            <InputGroup>
               <InputGroupInput
                  autoFocus
                  ref={inputRef}
                  aria-label="Editar telefone"
                  className="text-xs"
                  id={field.name}
                  name={field.name}
                  placeholder="(00) 00000-0000"
                  defaultValue={field.state.value}
                  onInput={(e) =>
                     field.handleChange((e.target as HTMLInputElement).value)
                  }
                  onBlur={() => {
                     if (!cancelledRef.current) form.handleSubmit();
                  }}
                  onKeyDown={(e) => {
                     if (e.key === "Enter") form.handleSubmit();
                     if (e.key === "Escape") {
                        cancelledRef.current = true;
                        onCancel();
                     }
                  }}
               />
               <InputGroupAddon align="inline-end">
                  <InputGroupButton
                     aria-label="Salvar"
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => form.handleSubmit()}
                  >
                     <Check />
                  </InputGroupButton>
               </InputGroupAddon>
            </InputGroup>
         )}
      </form.Field>
   );
}

function InlineTypeField({
   defaultValue,
   onCommit,
   onCancel,
}: {
   defaultValue: string;
   onCommit: (value: string) => void;
   onCancel: () => void;
}) {
   const form = useForm({
      defaultValues: { value: defaultValue || "cliente" },
      onSubmit: ({ value }) => onCommit(value.value),
   });

   return (
      <form.Field name="value">
         {(field) => (
            <Select
               defaultOpen
               value={field.state.value}
               onValueChange={(val) => {
                  field.handleChange(val);
                  form.handleSubmit();
               }}
               onOpenChange={(open) => {
                  if (!open) onCancel();
               }}
            >
               <SelectTrigger
                  className="h-6 text-xs"
                  onKeyDown={(e) => {
                     if (e.key === "Escape") onCancel();
                  }}
               >
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
               </SelectContent>
            </Select>
         )}
      </form.Field>
   );
}

const PHONE_MASK_OPTIONS: MaskitoOptions = {
   mask: [
      "(",
      /\d/,
      /\d/,
      ")",
      " ",
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      "-",
      /\d/,
      /\d/,
      /\d/,
      /\d/,
   ],
};

function formatDocument(doc: string): string {
   const digits = doc.replace(/\D/g, "");
   if (digits.length === 11)
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
   if (digits.length === 14)
      return digits.replace(
         /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
         "$1.$2.$3/$4-$5",
      );
   return doc;
}

export function ContactPropertiesPanel({ contact }: { contact: Contact }) {
   const { openAlertDialog } = useAlertDialog();

   const [editingField, setEditingField] = useState<FieldKey | null>(null);

   const { data: stats } = useSuspenseQuery(
      orpc.contacts.getStats.queryOptions({ input: { id: contact.id } }),
   );

   const phoneInputRef = useMaskito({ options: PHONE_MASK_OPTIONS });

   const documentMaskOptions: MaskitoOptions = useMemo(
      () => ({
         mask: ({ value }: { value: string }) => {
            const digits = value.replace(/\D/g, "");
            if (digits.length <= 11) {
               return [
                  /\d/,
                  /\d/,
                  /\d/,
                  ".",
                  /\d/,
                  /\d/,
                  /\d/,
                  ".",
                  /\d/,
                  /\d/,
                  /\d/,
                  "-",
                  /\d/,
                  /\d/,
               ];
            }
            return [
               /\d/,
               /\d/,
               ".",
               /\d/,
               /\d/,
               /\d/,
               ".",
               /\d/,
               /\d/,
               /\d/,
               "/",
               /\d/,
               /\d/,
               /\d/,
               /\d/,
               "-",
               /\d/,
               /\d/,
            ];
         },
      }),
      [],
   );
   const documentInputRef = useMaskito({ options: documentMaskOptions });

   const updateMutation = useMutation(
      orpc.contacts.update.mutationOptions({
         onSuccess: () => {
            toast.success("Contato atualizado.");
            setEditingField(null);
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   function cancelEdit() {
      setEditingField(null);
   }

   function commitEdit(field: FieldKey, value: string) {
      const trimmed = value.trim() === "" ? null : value.trim();
      const doUpdate = () =>
         updateMutation.mutate({ id: contact.id, [field]: trimmed });

      setEditingField(null);
      openAlertDialog({
         title: "Confirmar alteração",
         description: FIELD_WARNINGS[field],
         actionLabel: "Confirmar",
         cancelLabel: "Cancelar",
         onAction: doUpdate,
      });
   }

   const financial = FINANCIAL_CONFIG[contact.type];

   return (
      <div className="flex h-full flex-col gap-2 overflow-y-scroll px-2 py-4">
         <SectionHeader title="Dados">
            {contact.isArchived && (
               <Badge className="text-xs" variant="outline">
                  Arquivado
               </Badge>
            )}
         </SectionHeader>

         <ItemGroup>
            <PropRow
               icon={User}
               label="Nome"
               value={contact.name}
               editNode={
                  editingField === "name" ? (
                     <InlineTextField
                        defaultValue={contact.name}
                        onCommit={(v) => commitEdit("name", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("name")}
            />
            <PropRow
               icon={Tag}
               label="Tipo"
               value={
                  <Badge className="text-xs" variant="outline">
                     {TYPE_LABELS[contact.type]}
                  </Badge>
               }
               editNode={
                  editingField === "type" ? (
                     <InlineTypeField
                        defaultValue={contact.type}
                        onCommit={(v) => commitEdit("type", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("type")}
            />
            <PropRow
               icon={Mail}
               label="Email"
               value={
                  contact.email ?? (
                     <span className="text-muted-foreground">—</span>
                  )
               }
               editNode={
                  editingField === "email" ? (
                     <InlineTextField
                        defaultValue={contact.email ?? ""}
                        inputType="email"
                        onCommit={(v) => commitEdit("email", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("email")}
            />
            <PropRow
               icon={Phone}
               label="Telefone"
               value={
                  contact.phone ?? (
                     <span className="text-muted-foreground">—</span>
                  )
               }
               editNode={
                  editingField === "phone" ? (
                     <InlinePhoneField
                        defaultValue={contact.phone ?? ""}
                        inputRef={phoneInputRef}
                        onCommit={(v) => commitEdit("phone", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("phone")}
            />
            <PropRow
               icon={FileText}
               label="Documento"
               value={
                  contact.document ? (
                     <span className="font-mono">
                        {formatDocument(contact.document)}
                     </span>
                  ) : (
                     <span className="text-muted-foreground">—</span>
                  )
               }
               editNode={
                  editingField === "document" ? (
                     <InlineDocumentField
                        defaultValue={contact.document ?? ""}
                        inputRef={documentInputRef}
                        onCommit={(v) => commitEdit("document", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("document")}
            />
            <PropRow
               icon={AlignLeft}
               label="Observações"
               value={
                  contact.notes ?? (
                     <span className="text-muted-foreground">—</span>
                  )
               }
               editNode={
                  editingField === "notes" ? (
                     <InlineTextareaField
                        defaultValue={contact.notes ?? ""}
                        onCommit={(v) => commitEdit("notes", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("notes")}
            />
            <PropRow
               icon={Calendar}
               label="Cliente desde"
               value={
                  stats.firstTransactionDate
                     ? dayjs(stats.firstTransactionDate).format("DD/MM/YYYY")
                     : dayjs(contact.createdAt).format("DD/MM/YYYY")
               }
            />
         </ItemGroup>

         <SectionHeader title="Insights" tooltip={financial.tooltip} />

         <ItemGroup>
            {contact.type !== "fornecedor" && (
               <ContextPanelMeta
                  icon={TrendingUp}
                  label={
                     contact.type === "ambos" ? "Recebido" : financial.label
                  }
                  value={
                     <span className="text-emerald-600 dark:text-emerald-400">
                        {format(of(stats.totalIncome, "BRL"), "pt-BR")}
                     </span>
                  }
               />
            )}
            {contact.type !== "cliente" && (
               <ContextPanelMeta
                  icon={TrendingDown}
                  label={contact.type === "ambos" ? "Pago" : financial.label}
                  value={
                     <span className="text-rose-600 dark:text-rose-400">
                        {format(of(stats.totalExpense, "BRL"), "pt-BR")}
                     </span>
                  }
               />
            )}
         </ItemGroup>
      </div>
   );
}
