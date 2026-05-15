import { format, of } from "@f-o-t/money";
import dayjs from "dayjs";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useMutation } from "@tanstack/react-query";
import type { ColumnDef, Row } from "@tanstack/react-table";
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
import { InlineEditCombobox } from "@/blocks/data-table/inline-edit/inline-edit-combobox";
import { InlineEditDate } from "@/blocks/data-table/inline-edit/inline-edit-date";
import { InlineEditMoney } from "@/blocks/data-table/inline-edit/inline-edit-money";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import { BankLogoAvatar } from "@/components/bank-logo-avatar";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

export type TransactionRow = Outputs["transactions"]["getAll"]["data"][number];

export type BankAccountOption = {
   id: string;
   name: string;
   bankCode?: string | null;
   bankName?: string | null;
   color?: string | null;
};
export type ContactOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string };
export type CreditCardOption = { id: string; name: string };

export function formatBRL(value: string | number): string {
   const raw = String(value).trim();
   return format(of(raw === "" ? "0" : raw, "BRL"), "pt-BR");
}

function isImportRow(row: Row<TransactionRow>): number | null {
   const id = String(row.id);
   if (!id.startsWith("__import_")) return null;
   const idx = Number(id.replace("__import_", ""));
   return Number.isFinite(idx) ? idx : null;
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
         <PopoverContent className="w-56 p-4">
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

export function buildTransactionColumns(options?: {
   bankAccounts?: BankAccountOption[];
   contacts?: ContactOption[];
   categories?: CategoryOption[];
   creditCards?: CreditCardOption[];
   onUpdate?: (id: string, patch: Record<string, unknown>) => Promise<void>;
   onUpdateImport?: (index: number, patch: Record<string, unknown>) => void;
   onCreateBankAccount?: (name: string) => Promise<string>;
   onCreateContact?: (name: string) => Promise<string>;
   onCreateCategory?: (name: string) => Promise<string>;
   getRowStatus?: (id: string) => string | undefined;
   logoDevToken?: string;
}): ColumnDef<TransactionRow>[] {
   const statusOptions = [
      { value: "pending", label: "Pendente" },
      { value: "paid", label: "Efetivado" },
   ];
   const typeOptions = [
      { value: "income", label: "Receita" },
      { value: "expense", label: "Despesa" },
      { value: "transfer", label: "Transferência" },
   ];

   async function dispatchPatch(
      row: Row<TransactionRow>,
      patch: Record<string, unknown>,
   ) {
      const importIdx = isImportRow(row);
      if (importIdx !== null) {
         options?.onUpdateImport?.(importIdx, patch);
         return;
      }
      await options?.onUpdate?.(row.original.id, patch);
   }

   const contactOptions = (options?.contacts ?? []).map((c) => ({
      value: c.id,
      label: c.name,
   }));
   const categoryOptionsList = (options?.categories ?? []).map((c) => ({
      value: c.id,
      label: c.name,
   }));
   const bankOptions = (options?.bankAccounts ?? []).map((a) => ({
      value: a.id,
      label: a.name,
   }));
   const bankAccountsById = new Map(
      (options?.bankAccounts ?? []).map((a) => [a.id, a]),
   );
   const creditCardOptions = (options?.creditCards ?? []).map((c) => ({
      value: c.id,
      label: c.name,
   }));

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
            editOptions: statusOptions,
         },
         cell: ({ row }) => {
            if (row.original.ignored) {
               return (
                  <Badge className="text-xs" variant="secondary">
                     Ignorado
                  </Badge>
               );
            }
            const status =
               row.original.status === "cancelled"
                  ? "pending"
                  : row.original.status;
            return (
               <InlineEditSelect
                  ariaLabel="Status"
                  onSave={async (value) =>
                     dispatchPatch(row, { status: value })
                  }
                  options={statusOptions}
                  value={status}
               />
            );
         },
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
            required: true,
            groupable: true,
            formatGroupLabel: (value) => {
               if (!value) return "Sem data";
               const d = dayjs(String(value));
               return d.isValid() ? d.format("DD/MM/YYYY") : String(value);
            },
         },
         cell: ({ row }) => {
            const { status, date, dueDate } = row.original;
            const display = status === "pending" && dueDate ? dueDate : date;
            return (
               <InlineEditDate
                  ariaLabel="Data"
                  onSave={async (value) => {
                     const importIdx = isImportRow(row);
                     if (importIdx !== null) {
                        const field = status === "pending" ? "dueDate" : "date";
                        options?.onUpdateImport?.(importIdx, {
                           [field]: value || null,
                        });
                        return;
                     }
                     const rowStatus = options?.getRowStatus?.(row.original.id);
                     const field = rowStatus === "pending" ? "dueDate" : "date";
                     await options?.onUpdate?.(row.original.id, {
                        [field]: value || null,
                     });
                  }}
                  value={display ?? null}
               />
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
         },
         cell: ({ row }) => (
            <InlineEditDate
               ariaLabel="Vencimento"
               onSave={async (value) =>
                  dispatchPatch(row, { dueDate: value || null })
               }
               value={row.original.dueDate ?? null}
            />
         ),
      },
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            cellComponent: "text",
            isEditable: true,
            editMode: "inline",
         },
         cell: ({ row }) => (
            <InlineEditText
               ariaLabel="Nome"
               onSave={async (value) =>
                  dispatchPatch(row, { name: value.trim() || null })
               }
               placeholder="—"
               value={row.original.name ?? ""}
            />
         ),
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
            editOptions: typeOptions,
            required: true,
         },
         cell: ({ row }) => (
            <InlineEditSelect
               ariaLabel="Tipo"
               onSave={async (value) => dispatchPatch(row, { type: value })}
               options={typeOptions}
               value={row.original.type}
            />
         ),
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
            editOptions: contactOptions,
            onCreateOption: options?.onCreateContact,
         },
         cell: ({ row }) => (
            <InlineEditCombobox
               ariaLabel="Fornecedor/Cliente"
               onCreate={options?.onCreateContact}
               onSave={async (value) => {
                  const label =
                     contactOptions.find((o) => o.value === value)?.label ?? "";
                  const importIdx = isImportRow(row);
                  if (importIdx !== null) {
                     options?.onUpdateImport?.(importIdx, {
                        contactId: value || null,
                        contactName: label,
                     });
                     return;
                  }
                  await options?.onUpdate?.(row.original.id, {
                     contactId: value || null,
                  });
               }}
               options={contactOptions}
               value={
                  contactOptions.find(
                     (o) => o.label === row.original.contactName,
                  )?.value ?? ""
               }
            />
         ),
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
            editOptions: categoryOptionsList,
            onCreateOption: options?.onCreateCategory,
            groupable: true,
            formatGroupLabel: (value) =>
               value ? String(value) : "Sem categoria",
         },
         cell: ({ row }) => {
            const hasSuggestion =
               !row.original.categoryName && row.original.suggestedCategoryId;
            if (hasSuggestion && isImportRow(row) === null) {
               return (
                  <SuggestedCategoryCell
                     id={row.original.id}
                     categoryName={row.original.suggestedCategoryName ?? null}
                  />
               );
            }
            return (
               <InlineEditCombobox
                  ariaLabel="Categoria"
                  onCreate={options?.onCreateCategory}
                  onSave={async (value) => {
                     const label =
                        categoryOptionsList.find((o) => o.value === value)
                           ?.label ?? "";
                     const importIdx = isImportRow(row);
                     if (importIdx !== null) {
                        options?.onUpdateImport?.(importIdx, {
                           categoryId: value || null,
                           categoryName: label,
                        });
                        return;
                     }
                     await options?.onUpdate?.(row.original.id, {
                        categoryId: value || null,
                     });
                  }}
                  options={categoryOptionsList}
                  value={
                     categoryOptionsList.find(
                        (o) => o.label === row.original.categoryName,
                     )?.value ?? ""
                  }
               />
            );
         },
      },
      {
         accessorKey: "bankAccountName",
         header: "Conta",
         meta: {
            label: "Conta",
            align: "center",
            cellComponent: "combobox",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Landmark,
            bulkEditAction: "Definir conta",
            editOptions: bankOptions,
            onCreateOption: options?.onCreateBankAccount,
            required: true,
         },
         cell: ({ row }) => {
            const importIdx = isImportRow(row);
            if (importIdx !== null) {
               return (
                  <InlineEditCombobox
                     ariaLabel="Conta"
                     onCreate={options?.onCreateBankAccount}
                     onSave={async (value) => {
                        const label =
                           bankOptions.find((o) => o.value === value)?.label ??
                           "";
                        options?.onUpdateImport?.(importIdx, {
                           bankAccountId: value || null,
                           bankAccountName: label,
                        });
                     }}
                     options={bankOptions}
                     value={
                        bankOptions.find(
                           (o) => o.label === row.original.bankAccountName,
                        )?.value ?? ""
                     }
                  />
               );
            }

            const accountId =
               row.original.bankAccountId ??
               bankOptions.find((o) => o.label === row.original.bankAccountName)
                  ?.value;
            const account = accountId
               ? bankAccountsById.get(accountId)
               : undefined;
            const accountName = account?.name ?? row.original.bankAccountName;
            const accountLogo = accountName ? (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <span
                        aria-label={accountName}
                        className="inline-flex items-center"
                     >
                        <BankLogoAvatar
                           bankCode={account?.bankCode}
                           bankName={account?.bankName}
                           color={account?.color}
                           logoDevToken={options?.logoDevToken}
                           name={accountName}
                           size="md"
                        />
                     </span>
                  </TooltipTrigger>
                  <TooltipContent>{accountName}</TooltipContent>
               </Tooltip>
            ) : null;

            return (
               <InlineEditCombobox
                  ariaLabel="Conta"
                  className="w-auto justify-center border-0 bg-transparent p-0 shadow-none hover:bg-transparent [&>svg]:hidden [&>span]:flex-none"
                  onCreate={options?.onCreateBankAccount}
                  onSave={async (value) => {
                     await options?.onUpdate?.(row.original.id, {
                        bankAccountId: value || null,
                     });
                  }}
                  options={bankOptions}
                  renderSelected={() =>
                     accountLogo ?? (
                        <span className="text-muted-foreground">—</span>
                     )
                  }
                  value={accountId ?? ""}
               />
            );
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
            editOptions: creditCardOptions,
         },
         cell: ({ row }) => (
            <InlineEditCombobox
               ariaLabel="Cartão"
               onSave={async (value) => {
                  const label =
                     creditCardOptions.find((o) => o.value === value)?.label ??
                     "";
                  const importIdx = isImportRow(row);
                  if (importIdx !== null) {
                     options?.onUpdateImport?.(importIdx, {
                        creditCardId: value || null,
                        creditCardName: label,
                     });
                     return;
                  }
                  await options?.onUpdate?.(row.original.id, {
                     creditCardId: value || null,
                  });
               }}
               options={creditCardOptions}
               value={
                  creditCardOptions.find(
                     (o) => o.label === row.original.creditCardName,
                  )?.value ?? ""
               }
            />
         ),
      },
      {
         accessorKey: "amount",
         header: "Valor",
         meta: {
            label: "Valor",
            filterVariant: "range",
            exportable: true,
            cellComponent: "money",
            isEditable: true,
            editMode: "inline",
            required: true,
         },
         cell: ({ row }) => {
            const { type, amount } = row.original;
            const numeric = Number(amount) || 0;
            const colorClass =
               type === "income"
                  ? "[&_input]:text-right [&_input]:text-green-600 dark:[&_input]:text-green-500"
                  : type === "expense"
                    ? "[&_input]:text-right [&_input]:text-destructive"
                    : "[&_input]:text-right [&_input]:text-muted-foreground";
            return (
               <InlineEditMoney
                  ariaLabel="Valor"
                  className={colorClass}
                  onSave={async (value) =>
                     dispatchPatch(row, { amount: value })
                  }
                  value={numeric}
                  valueInCents={false}
               />
            );
         },
      },
   ];
}
