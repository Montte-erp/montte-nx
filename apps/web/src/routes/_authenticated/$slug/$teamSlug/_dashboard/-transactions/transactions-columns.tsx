import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
   ArrowUpDown,
   CalendarClock,
   CalendarDays,
   CircleDot,
   CreditCard,
   Landmark,
   Tag,
   User,
} from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

export type TransactionRow = Outputs["transactions"]["getAll"]["data"][number];

export type BankAccountOption = { id: string; name: string };
export type ContactOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string };
export type CreditCardOption = { id: string; name: string };

export function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatDate(dateStr: string): string {
   const [year, month, day] = dateStr.split("-");
   return `${day}/${month}/${year}`;
}

function SuggestedCategoryCell({
   id,
   categoryName,
}: {
   id: string;
   categoryName: string | null;
}) {
   const accept = useMutation(
      orpc.transactions.acceptSuggestedCategory.mutationOptions(),
   );
   const dismiss = useMutation(
      orpc.transactions.dismissSuggestedCategory.mutationOptions(),
   );

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Badge variant="outline" className="text-xs cursor-pointer">
               sugestão IA
            </Badge>
         </PopoverTrigger>
         <PopoverContent className="w-56 p-3">
            {categoryName && (
               <p className="text-sm font-medium">{categoryName}</p>
            )}
            <p className="text-sm text-muted-foreground">
               Categoria sugerida pela IA. Deseja aceitar?
            </p>
            <div className="flex gap-2">
               <Button
                  size="sm"
                  className="flex-1"
                  disabled={accept.isPending || dismiss.isPending}
                  onClick={() => accept.mutate({ id })}
               >
                  Aceitar
               </Button>
               <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={accept.isPending || dismiss.isPending}
                  onClick={() => dismiss.mutate({ id })}
               >
                  Ignorar
               </Button>
            </div>
         </PopoverContent>
      </Popover>
   );
}

function StatusBadge({ status }: { status: "pending" | "paid" | "cancelled" }) {
   if (status === "pending") {
      return (
         <Badge
            className="border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400"
            variant="outline"
         >
            Pendente
         </Badge>
      );
   }
   if (status === "cancelled") {
      return <Badge variant="secondary">Cancelado</Badge>;
   }
   return (
      <Badge
         className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
         variant="outline"
      >
         Efetivado
      </Badge>
   );
}

export function buildTransactionColumns(options?: {
   bankAccounts?: BankAccountOption[];
   contacts?: ContactOption[];
   categories?: CategoryOption[];
   creditCards?: CreditCardOption[];
   onUpdate?: (id: string, patch: Record<string, unknown>) => Promise<void>;
   onCreateBankAccount?: (name: string) => Promise<string>;
   onCreateContact?: (name: string) => Promise<string>;
   onCreateCategory?: (name: string) => Promise<string>;
}): ColumnDef<TransactionRow>[] {
   return [
      {
         accessorKey: "status",
         header: "Status",
         meta: {
            label: "Status",
            cellComponent: "select",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: CircleDot,
            bulkEditAction: "Alterar status",
            editOptions: [
               { value: "pending", label: "Pendente" },
               { value: "paid", label: "Efetivado" },
               { value: "cancelled", label: "Cancelado" },
            ],
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, { status: value });
            },
         },
         cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
         accessorKey: "date",
         header: ({ table }) => {
            const rows = table.getRowModel().rows;
            const allPending =
               rows.length > 0 &&
               rows.every((r) => r.original.status === "pending");
            return allPending ? "Vencimento" : "Data";
         },
         meta: {
            label: "Data",
            cellComponent: "date",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: CalendarDays,
            bulkEditAction: "Alterar data",
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, { date: value || null });
            },
         },
         cell: ({ row }) => {
            const { status, date, dueDate } = row.original;
            const display = status === "pending" && dueDate ? dueDate : date;
            return (
               <span className="text-sm tabular-nums">
                  {formatDate(display)}
               </span>
            );
         },
      },
      {
         accessorKey: "dueDate",
         header: "Vencimento",
         meta: {
            label: "Vencimento",
            cellComponent: "date",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: CalendarClock,
            bulkEditAction: "Alterar vencimento",
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, { dueDate: value || null });
            },
         },
         cell: ({ row }) => {
            const { dueDate } = row.original;
            if (!dueDate)
               return <span className="text-xs text-muted-foreground">—</span>;
            return (
               <span className="text-sm tabular-nums">
                  {formatDate(dueDate)}
               </span>
            );
         },
      },
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            cellComponent: "text",
            isEditable: true,
            editMode: "inline",
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, {
                  name: String(value).trim() || null,
               });
            },
         },
         cell: ({ row }) => {
            const { name } = row.original;
            if (!name)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <span className="text-sm font-medium truncate max-w-[200px] block">
                  {name}
               </span>
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         meta: {
            label: "Tipo",
            cellComponent: "select",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: ArrowUpDown,
            bulkEditAction: "Alterar tipo",
            editOptions: [
               { value: "income", label: "Receita" },
               { value: "expense", label: "Despesa" },
               { value: "transfer", label: "Transferência" },
            ],
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, { type: value });
            },
         },
         cell: ({ row }) => {
            const { type } = row.original;
            if (type === "income") {
               return (
                  <Badge
                     className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
                     variant="outline"
                  >
                     Receita
                  </Badge>
               );
            }
            if (type === "expense") {
               return <Badge variant="destructive">Despesa</Badge>;
            }
            return <Badge variant="secondary">Transferência</Badge>;
         },
      },
      {
         accessorKey: "contactName",
         header: "Fornecedor/Cliente",
         meta: {
            label: "Fornecedor/Cliente",
            cellComponent: "combobox",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: User,
            bulkEditAction: "Atribuir contato",
            editOptions: options?.contacts?.map((c) => ({
               value: c.id,
               label: c.name,
            })),
            onCreateOption: options?.onCreateContact,
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, {
                  contactId: String(value) || null,
               });
            },
         },
         cell: ({ row }) => {
            const name = row.original.contactName;
            if (!name)
               return <span className="text-xs text-muted-foreground">—</span>;
            return <span className="text-sm">{name}</span>;
         },
      },
      {
         accessorKey: "categoryName",
         header: "Categoria",
         meta: {
            label: "Categoria",
            cellComponent: "combobox",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Tag,
            bulkEditAction: "Categorizar",
            editOptions: options?.categories?.map((c) => ({
               value: c.id,
               label: c.name,
            })),
            onCreateOption: options?.onCreateCategory,
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, {
                  categoryId: String(value) || null,
               });
            },
         },
         cell: ({ row }) => {
            const name = row.original.categoryName;
            const hasSuggestion = !name && row.original.suggestedCategoryId;
            if (!name && !hasSuggestion)
               return <span className="text-xs text-muted-foreground">—</span>;
            if (hasSuggestion)
               return (
                  <SuggestedCategoryCell
                     id={row.original.id}
                     categoryName={row.original.suggestedCategoryName ?? null}
                  />
               );
            return <span className="text-sm">{name}</span>;
         },
      },
      {
         accessorKey: "bankAccountName",
         header: "Conta",
         meta: {
            label: "Conta",
            cellComponent: "combobox",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Landmark,
            bulkEditAction: "Definir conta",
            editOptions: options?.bankAccounts?.map((a) => ({
               value: a.id,
               label: a.name,
            })),
            onCreateOption: options?.onCreateBankAccount,
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, {
                  bankAccountId: String(value) || null,
               });
            },
         },
         cell: ({ row }) => {
            const name = row.original.bankAccountName;
            if (!name)
               return <span className="text-xs text-muted-foreground">—</span>;
            return <span className="text-sm">{name}</span>;
         },
      },
      {
         accessorKey: "creditCardName",
         header: "Cartão",
         meta: {
            label: "Cartão",
            cellComponent: "combobox",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: CreditCard,
            bulkEditAction: "Definir cartão",
            editOptions: options?.creditCards?.map((c) => ({
               value: c.id,
               label: c.name,
            })),
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, {
                  creditCardId: String(value) || null,
               });
            },
         },
         cell: ({ row }) => {
            const name = row.original.creditCardName;
            if (!name)
               return <span className="text-xs text-muted-foreground">—</span>;
            return <span className="text-sm">{name}</span>;
         },
      },
      {
         accessorKey: "amount",
         header: "Valor",
         meta: {
            label: "Valor",
            align: "right",
            filterVariant: "range",
            exportable: true,
            cellComponent: "money",
            isEditable: true,
            editMode: "inline",
            onSave: async (rowId, value) => {
               await options?.onUpdate?.(rowId, { amount: value });
            },
         },
         cell: ({ row }) => {
            const { type, amount } = row.original;
            if (type === "income") {
               return (
                  <span className="text-sm font-medium text-green-600 dark:text-green-500">
                     {formatBRL(amount)}
                  </span>
               );
            }
            if (type === "expense") {
               return (
                  <span className="text-sm font-medium text-destructive">
                     - {formatBRL(amount)}
                  </span>
               );
            }
            return (
               <span className="text-sm font-medium text-muted-foreground">
                  {formatBRL(amount)}
               </span>
            );
         },
      },
   ];
}
