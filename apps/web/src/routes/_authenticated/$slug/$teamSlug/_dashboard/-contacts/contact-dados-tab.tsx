import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Textarea } from "@packages/ui/components/textarea";
import type { MaskitoOptions } from "@maskito/core";
import { useMaskito } from "@maskito/react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { format, of } from "@f-o-t/money";
import { Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

type Contact = Outputs["contacts"]["getById"];

type EditRowProps = {
   label: string;
   isLast?: boolean;
   onEdit: () => void;
   children: React.ReactNode;
};

function EditRow({ label, isLast, onEdit, children }: EditRowProps) {
   return (
      <div
         className={`group flex items-start gap-4 px-4 py-3${isLast ? "" : " border-b"}`}
      >
         <span className="w-28 shrink-0 text-xs text-muted-foreground">
            {label}
         </span>
         <div className="flex flex-1 items-center gap-2">
            <div className="flex-1 text-sm">{children}</div>
            <Button
               className="size-6 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
               size="icon"
               variant="ghost"
               onClick={onEdit}
            >
               <Pencil className="size-3" />
               <span className="sr-only">Editar</span>
            </Button>
         </div>
      </div>
   );
}

type FieldKey = "name" | "type" | "email" | "phone" | "document" | "notes";

export function ContactDadosTab({ contact }: { contact: Contact }) {
   const [editingField, setEditingField] = useState<FieldKey | null>(null);
   const [editValue, setEditValue] = useState<string>("");

   const { data: stats } = useSuspenseQuery(
      orpc.contacts.getStats.queryOptions({ input: { id: contact.id } }),
   );

   const updateMutation = useMutation(
      orpc.contacts.update.mutationOptions({
         onSuccess: () => {
            toast.success("Contato atualizado.");
            setEditingField(null);
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   function startEdit(field: FieldKey, current: string | null | undefined) {
      setEditingField(field);
      setEditValue(current ?? "");
   }

   function cancelEdit() {
      setEditingField(null);
      setEditValue("");
   }

   function commitEdit(field: FieldKey) {
      const value = editValue.trim() === "" ? null : editValue.trim();
      updateMutation.mutate({ id: contact.id, [field]: value });
   }

   function handleKeyDown(e: React.KeyboardEvent, field: FieldKey) {
      if (e.key === "Enter" && field !== "notes") {
         commitEdit(field);
      }
      if (e.key === "Escape") {
         cancelEdit();
      }
   }

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

   const typeLabels: Record<Contact["type"], string> = {
      cliente: "Cliente",
      fornecedor: "Fornecedor",
      ambos: "Ambos",
   };

   return (
      <div className="flex flex-col gap-4">
         <div className="group rounded-lg border">
            <EditRow
               label="Nome"
               onEdit={() => startEdit("name", contact.name)}
            >
               {editingField === "name" ? (
                  <input
                     autoFocus
                     className="w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1"
                     value={editValue}
                     onBlur={() => commitEdit("name")}
                     onChange={(e) => setEditValue(e.target.value)}
                     onKeyDown={(e) => handleKeyDown(e, "name")}
                  />
               ) : (
                  <span>{contact.name}</span>
               )}
            </EditRow>

            <EditRow
               label="Tipo"
               onEdit={() => startEdit("type", contact.type)}
            >
               {editingField === "type" ? (
                  <Select
                     defaultOpen
                     value={editValue || contact.type}
                     onValueChange={(val) => {
                        setEditValue(val);
                        updateMutation.mutate({
                           id: contact.id,
                           type: val as Contact["type"],
                        });
                     }}
                  >
                     <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                     </SelectContent>
                  </Select>
               ) : (
                  <span>{typeLabels[contact.type]}</span>
               )}
            </EditRow>

            <EditRow
               label="Email"
               onEdit={() => startEdit("email", contact.email)}
            >
               {editingField === "email" ? (
                  <input
                     autoFocus
                     className="w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1"
                     type="email"
                     value={editValue}
                     onBlur={() => commitEdit("email")}
                     onChange={(e) => setEditValue(e.target.value)}
                     onKeyDown={(e) => handleKeyDown(e, "email")}
                  />
               ) : (
                  <span
                     className={contact.email ? "" : "text-muted-foreground"}
                  >
                     {contact.email ?? "—"}
                  </span>
               )}
            </EditRow>

            <EditRow
               label="Telefone"
               onEdit={() => startEdit("phone", contact.phone)}
            >
               {editingField === "phone" ? (
                  <input
                     autoFocus
                     className="w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1"
                     value={editValue}
                     onBlur={() => commitEdit("phone")}
                     onChange={(e) => setEditValue(e.target.value)}
                     onKeyDown={(e) => handleKeyDown(e, "phone")}
                  />
               ) : (
                  <span
                     className={contact.phone ? "" : "text-muted-foreground"}
                  >
                     {contact.phone ?? "—"}
                  </span>
               )}
            </EditRow>

            <EditRow
               label="Documento"
               onEdit={() => startEdit("document", contact.document)}
            >
               {editingField === "document" ? (
                  <input
                     autoFocus
                     ref={documentInputRef}
                     className="w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1"
                     key={`document-${editingField}`}
                     placeholder="CPF ou CNPJ"
                     defaultValue={editValue}
                     onBlur={(e) => {
                        setEditValue(e.target.value);
                        commitEdit("document");
                     }}
                     onInput={(e) =>
                        setEditValue((e.target as HTMLInputElement).value)
                     }
                     onKeyDown={(e) => handleKeyDown(e, "document")}
                  />
               ) : (
                  <span
                     className={contact.document ? "" : "text-muted-foreground"}
                  >
                     {contact.document ?? "—"}
                  </span>
               )}
            </EditRow>

            <EditRow
               isLast
               label="Observações"
               onEdit={() => startEdit("notes", contact.notes)}
            >
               {editingField === "notes" ? (
                  <Textarea
                     autoFocus
                     className="text-sm"
                     value={editValue}
                     onBlur={() => commitEdit("notes")}
                     onChange={(e) => setEditValue(e.target.value)}
                     onKeyDown={(e) => handleKeyDown(e, "notes")}
                  />
               ) : (
                  <span
                     className={contact.notes ? "" : "text-muted-foreground"}
                  >
                     {contact.notes ?? "—"}
                  </span>
               )}
            </EditRow>
         </div>

         <Card>
            <CardHeader>
               <CardTitle>Resumo financeiro</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex gap-4">
                  <div className="flex flex-1 flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
                     <div className="flex items-center gap-2">
                        <TrendingUp className="size-4 text-emerald-600" />
                        <span className="text-xs text-muted-foreground">
                           Receitas
                        </span>
                     </div>
                     <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                        {format(of(stats.totalIncome, "BRL"), "pt-BR")}
                     </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950">
                     <div className="flex items-center gap-2">
                        <TrendingDown className="size-4 text-rose-600" />
                        <span className="text-xs text-muted-foreground">
                           Despesas
                        </span>
                     </div>
                     <span className="text-lg font-semibold text-rose-700 dark:text-rose-400">
                        {format(of(stats.totalExpense, "BRL"), "pt-BR")}
                     </span>
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>
   );
}
