import { format, of } from "@f-o-t/money";
import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Banknote,
   Calendar,
   CalendarClock,
   CreditCard as CreditCardIcon,
   Hash,
   Landmark,
   Tag,
} from "lucide-react";
import { InlineEditCombobox } from "@/blocks/data-table/inline-edit/inline-edit-combobox";
import { InlineEditMoney } from "@/blocks/data-table/inline-edit/inline-edit-money";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import type { Outputs } from "@/integrations/orpc/client";
import {
   BRAND_COLOR,
   BRAND_LABEL,
   bankInitials,
   bankLogoUrl,
   brandLogoUrl,
} from "@/lib/logos";

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

const STATUS_VARIANT = {
   active: "success",
   blocked: "secondary",
   cancelled: "destructive",
} as const;

const STATUS_LABEL = {
   active: "Ativo",
   blocked: "Bloqueado",
   cancelled: "Cancelado",
} as const;

const BRAND_OPTIONS = [
   { value: "visa", label: "Visa" },
   { value: "mastercard", label: "Mastercard" },
   { value: "elo", label: "Elo" },
   { value: "amex", label: "Amex" },
   { value: "hipercard", label: "Hipercard" },
   { value: "other", label: "Outro" },
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
            cellComponent: "text" as const,
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
            cellComponent: "select" as const,
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Tag,
            bulkEditAction: "Alterar bandeira",
            editOptions: BRAND_OPTIONS,
            required: true,
            exportValue: (row) =>
               row.brand ? (BRAND_LABEL[row.brand] ?? row.brand) : "",
         },
         cell: ({ row }) => {
            const brand = row.original.brand;
            const color =
               brand && (BRAND_COLOR[brand] ?? BRAND_COLOR.other ?? "#000000");
            const logo = brand ? brandLogoUrl(brand) : null;
            return (
               <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-4 shrink-0 rounded-lg bg-white ring-1 ring-border">
                     {logo ? (
                        <AvatarImage
                           alt={brand ? (BRAND_LABEL[brand] ?? brand) : ""}
                           className="object-contain"
                           src={logo}
                        />
                     ) : null}
                     <AvatarFallback
                        className="rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: color || "#6366f1" }}
                     >
                        <CreditCardIcon className="size-2" />
                     </AvatarFallback>
                  </Avatar>
                  <InlineEditSelect
                     ariaLabel="Bandeira"
                     onSave={async (value) =>
                        onUpdate?.(row.original.id, { brand: value })
                     }
                     options={BRAND_OPTIONS}
                     placeholder="—"
                     value={brand ?? ""}
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
            cellComponent: "money" as const,
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
            cellComponent: "select" as const,
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: CalendarClock,
            bulkEditAction: "Alterar fechamento",
            editOptions: DAY_OPTIONS,
            required: true,
            exportValue: (row) => `Dia ${row.closingDay}`,
         },
         cell: ({ row }) => (
            <InlineEditSelect
               ariaLabel="Fechamento"
               onSave={async (value) =>
                  onUpdate?.(row.original.id, {
                     closingDay: Number.parseInt(value, 10),
                  })
               }
               options={DAY_OPTIONS}
               value={String(row.original.closingDay)}
            />
         ),
      },
      {
         accessorKey: "dueDay",
         header: "Vencimento",
         meta: {
            label: "Vencimento",
            cellComponent: "select" as const,
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Calendar,
            bulkEditAction: "Alterar vencimento",
            editOptions: DAY_OPTIONS,
            required: true,
            exportValue: (row) => `Dia ${row.dueDay}`,
         },
         cell: ({ row }) => (
            <InlineEditSelect
               ariaLabel="Vencimento"
               onSave={async (value) =>
                  onUpdate?.(row.original.id, {
                     dueDay: Number.parseInt(value, 10),
                  })
               }
               options={DAY_OPTIONS}
               value={String(row.original.dueDay)}
            />
         ),
      },
      {
         accessorKey: "bankAccountId",
         header: "Conta Bancária",
         meta: {
            label: "Conta Bancária",
            cellComponent: "combobox" as const,
            isEditable: true,
            editMode: "inline",
            bulkEditIcon: Landmark,
            bulkEditAction: "Definir conta",
            editOptions: bankComboboxOptions,
            required: true,
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
            const logo = account
               ? bankLogoUrl(account.bankCode, logoDevToken)
               : null;
            return (
               <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-4 shrink-0 rounded-lg bg-white ring-1 ring-border">
                     {logo ? (
                        <AvatarImage
                           alt={issuer}
                           className="object-contain"
                           src={logo}
                        />
                     ) : null}
                     <AvatarFallback
                        className="rounded-lg text-xs font-semibold text-white"
                        style={{
                           backgroundColor: account?.color ?? "#6366f1",
                        }}
                     >
                        {account?.bankName ? (
                           bankInitials(account.bankName)
                        ) : (
                           <Landmark className="size-2" />
                        )}
                     </AvatarFallback>
                  </Avatar>
                  <InlineEditCombobox
                     ariaLabel="Conta Bancária"
                     onSave={async (value) =>
                        onUpdate?.(row.original.id, { bankAccountId: value })
                     }
                     options={bankComboboxOptions}
                     value={row.original.bankAccountId}
                  />
               </div>
            );
         },
      },
      {
         accessorKey: "status",
         header: "Status",
         meta: {
            label: "Status",
            filterVariant: "select",
            bulkEditIcon: Hash,
            exportValue: (row) => STATUS_LABEL[row.status] ?? row.status,
         },
         cell: ({ row }) => {
            const status = row.original.status;
            return (
               <Badge variant={STATUS_VARIANT[status] ?? "default"}>
                  {STATUS_LABEL[status] ?? status}
               </Badge>
            );
         },
      },
   ];
}
