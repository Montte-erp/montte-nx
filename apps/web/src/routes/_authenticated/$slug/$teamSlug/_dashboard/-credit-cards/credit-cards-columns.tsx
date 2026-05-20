import { format, of } from "@f-o-t/money";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Banknote,
   Calendar,
   CalendarClock,
   Hash,
   Landmark,
} from "lucide-react";
import { InlineEditCombobox } from "@/blocks/data-table/inline-edit/inline-edit-combobox";
import { InlineEditMoney } from "@/blocks/data-table/inline-edit/inline-edit-money";
import { InlineEditNumber } from "@/blocks/data-table/inline-edit/inline-edit-number";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import { BankLogoAvatar } from "@/components/bank-logo-avatar";
import { CreditCardBrandAvatar } from "@/components/credit-card-brand-avatar";
import type { Outputs } from "@/integrations/orpc/client";
import { BRAND_LABEL } from "@/lib/logos";

export type CreditCardRow = Outputs["creditCards"]["getAll"]["data"][number];

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatBankIssuerName(name: string): string {
   const parts = name.split(" - ");
   return parts.at(-1)?.trim() || name;
}

type BankAccountOption = {
   id: string;
   name: string;
   bankName?: string | null;
   bankCode?: string | null;
   color?: string | null;
};

const STATUS_LABEL = {
   active: "Ativo",
   blocked: "Bloqueado",
   cancelled: "Cancelado",
} as const;

const STATUS_OPTIONS = [
   { value: "active", label: "Ativo" },
   { value: "blocked", label: "Bloqueado" },
   { value: "cancelled", label: "Cancelado" },
];

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
   value: String(i + 1),
   label: String(i + 1),
}));

export function buildCreditCardColumns(options?: {
   bankAccounts?: Array<BankAccountOption>;
   logoDevToken?: string;
   onUpdate?: (id: string, patch: Record<string, unknown>) => Promise<unknown>;
}): ColumnDef<CreditCardRow>[] {
   const bankAccountEntries: Array<
      [BankAccountOption["id"], BankAccountOption]
   > = (options?.bankAccounts ?? []).map((b) => [b.id, b]);
   const bankAccountsById = new Map<BankAccountOption["id"], BankAccountOption>(
      bankAccountEntries,
   );
   const logoDevToken = options?.logoDevToken;
   const bankComboboxOptions = (options?.bankAccounts ?? []).map((a) => ({
      value: a.id,
      label: a.name,
   }));
   const onUpdate = options?.onUpdate;
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            cellComponent: "text",
            isEditable: true,
            editMode: "inline",
            required: true,
         },
         cell: ({ row }) => (
            <div className="flex min-w-0 flex-col">
               <InlineEditText
                  ariaLabel="Nome"
                  onSave={async (value) =>
                     onUpdate?.(row.original.id, { name: value.trim() })
                  }
                  placeholder="—"
                  value={row.original.name}
               />
               {row.original.last4 ? (
                  <span className="text-xs text-muted-foreground/90 tabular-nums">
                     Final {row.original.last4}
                  </span>
               ) : null}
            </div>
         ),
      },
      {
         accessorKey: "brand",
         header: "Bandeira",
         meta: {
            label: "Bandeira",
            align: "center",
            required: true,
            exportValue: (row) =>
               row.brand ? (BRAND_LABEL[row.brand] ?? row.brand) : "",
         },
         cell: ({ row }) => {
            const brand = row.original.brand;
            return (
               <div className="flex justify-center">
                  <CreditCardBrandAvatar
                     brand={brand}
                     logoDevToken={logoDevToken}
                     size="md"
                  />
               </div>
            );
         },
      },
      {
         accessorKey: "creditLimit",
         header: "Limite",
         meta: {
            label: "Limite",
            align: "right",
            headerAlign: "left",
            cellComponent: "money",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Banknote,
            bulkEditAction: "Alterar limite",
            exportValue: (row) => formatBRL(row.creditLimit),
         },
         cell: ({ row }) => {
            const numeric = Number(row.original.creditLimit) || 0;
            return (
               <InlineEditMoney
                  ariaLabel="Limite"
                  onSave={async (value) =>
                     onUpdate?.(row.original.id, {
                        creditLimit: String(value),
                     })
                  }
                  value={numeric}
                  valueInCents={false}
               />
            );
         },
      },
      {
         accessorKey: "closingDay",
         header: "Fechamento",
         meta: {
            label: "Fechamento",
            cellComponent: "select",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: CalendarClock,
            bulkEditAction: "Alterar fechamento",
            editOptions: DAY_OPTIONS,
            required: true,
            exportValue: (row) => `Dia ${row.closingDay}`,
         },
         cell: ({ row }) => (
            <InlineEditNumber
               ariaLabel="Fechamento"
               max={31}
               min={1}
               onSave={async (value) =>
                  onUpdate?.(row.original.id, { closingDay: value })
               }
               value={row.original.closingDay}
            />
         ),
      },
      {
         accessorKey: "dueDay",
         header: "Vencimento",
         meta: {
            label: "Vencimento",
            cellComponent: "select",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Calendar,
            bulkEditAction: "Alterar vencimento",
            editOptions: DAY_OPTIONS,
            required: true,
            exportValue: (row) => `Dia ${row.dueDay}`,
         },
         cell: ({ row }) => (
            <InlineEditNumber
               ariaLabel="Vencimento"
               max={31}
               min={1}
               onSave={async (value) =>
                  onUpdate?.(row.original.id, { dueDay: value })
               }
               value={row.original.dueDay}
            />
         ),
      },
      {
         id: "bankIssuer",
         header: "Banco",
         meta: {
            label: "Banco",
            pinnable: false,
            exportValue: (row) => {
               const account = bankAccountsById.get(row.bankAccountId);
               if (!account) return "";
               const issuer = account.bankName?.trim() || account.name;
               return formatBankIssuerName(issuer);
            },
         },
         cell: ({ row }) => {
            const account = bankAccountsById.get(row.original.bankAccountId);
            const issuer = account?.bankName?.trim() || account?.name || "";
            return (
               <div className="flex min-w-0 items-center gap-2">
                  <BankLogoAvatar
                     bankCode={account?.bankCode}
                     bankName={account?.bankName}
                     color={account?.color}
                     logoDevToken={logoDevToken}
                     name={issuer}
                     size="md"
                  />
                  <span className="truncate font-medium">
                     {formatBankIssuerName(issuer) || "—"}
                  </span>
               </div>
            );
         },
      },
      {
         accessorKey: "bankAccountId",
         header: "Conta Bancária",
         meta: {
            label: "Conta Bancária",
            cellComponent: "combobox",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Landmark,
            bulkEditAction: "Definir conta",
            editOptions: bankComboboxOptions,
            required: true,
            exportValue: (row) => {
               const account = bankAccountsById.get(row.bankAccountId);
               return account?.name ?? "";
            },
         },
         cell: ({ row }) => {
            return (
               <InlineEditCombobox
                  ariaLabel="Conta Bancária"
                  onSave={async (value) =>
                     onUpdate?.(row.original.id, { bankAccountId: value })
                  }
                  options={bankComboboxOptions}
                  value={row.original.bankAccountId}
               />
            );
         },
      },
      {
         accessorKey: "status",
         header: "Status",
         meta: {
            label: "Status",
            filterVariant: "select",
            cellComponent: "select",
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Hash,
            bulkEditAction: "Alterar status",
            editOptions: STATUS_OPTIONS,
            exportValue: (row) => STATUS_LABEL[row.status] ?? row.status,
         },
         cell: ({ row }) => (
            <InlineEditSelect
               ariaLabel="Status"
               onSave={async (value) =>
                  onUpdate?.(row.original.id, { status: value })
               }
               options={STATUS_OPTIONS}
               value={row.original.status}
            />
         ),
      },
   ];
}
