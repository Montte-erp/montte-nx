import { format, of } from "@f-o-t/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import {
   CalendarClock,
   CircleDollarSign,
   CreditCard,
   Info,
   Landmark,
   PiggyBank,
   Shapes,
   TrendingUp,
   Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import { InlineEditMoney } from "@/blocks/data-table/inline-edit/inline-edit-money";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import { BankLogoAvatar } from "@/components/bank-logo-avatar";

export type BankAccountRow = {
   id: string;
   teamId: string;
   name: string;
   type: "checking" | "savings" | "investment" | "payment" | "cash";
   color: string;
   iconUrl?: string | null;
   bankCode?: string | null;
   bankName?: string | null;
   initialBalance: string;
   currentBalance: string;
   projectedBalance: string;
   createdAt: Date | string;
   updatedAt: Date | string;
};

const TYPE_LABELS: Record<BankAccountRow["type"], string> = {
   cash: "Caixa Físico",
   checking: "Conta Corrente",
   savings: "Conta Poupança",
   payment: "Conta Pagamento",
   investment: "Conta Investimento",
};
const typeSchema = z.enum([
   "checking",
   "savings",
   "investment",
   "payment",
   "cash",
]);

const TYPE_ICONS: Record<BankAccountRow["type"], ReactNode> = {
   cash: <Wallet className="size-3" />,
   checking: <Landmark className="size-3" />,
   savings: <PiggyBank className="size-3" />,
   payment: <CreditCard className="size-3" />,
   investment: <TrendingUp className="size-3" />,
};

function formatBRL(value: string | number | null | undefined): string {
   if (value === null || value === undefined || value === "") return "—";

   const raw = String(value).trim();
   if (raw === "") return "—";

   const parsed = Number(raw);
   if (!Number.isFinite(parsed)) return "—";

   return format(of(raw, "BRL"), "pt-BR");
}

interface BuildBankAccountColumnsOptions {
   logoDevToken?: string;
   onRenameAccount?: (id: string, name: string) => Promise<void>;
   onUpdateAccount?: (
      id: string,
      patch: Record<string, unknown>,
   ) => Promise<void>;
}

const TYPE_OPTIONS: { value: BankAccountRow["type"]; label: string }[] = [
   { value: "checking", label: "Conta Corrente" },
   { value: "savings", label: "Conta Poupança" },
   { value: "investment", label: "Conta Investimento" },
   { value: "payment", label: "Conta Pagamento" },
   { value: "cash", label: "Caixa Físico" },
];

export function buildBankAccountColumns(
   options?: BuildBankAccountColumnsOptions,
): ColumnDef<BankAccountRow>[] {
   const canRenameAccount = Boolean(options?.onRenameAccount);
   const canUpdateAccount = Boolean(options?.onUpdateAccount);
   const logoDevToken = options?.logoDevToken;
   return [
      {
         id: "bank",
         header: "Banco",
         meta: {
            label: "Banco",
            filterVariant: "text",
            exportValue: (row) => row.bankName ?? "",
         },
         cell: ({ row }) => {
            const account = row.original;
            const bankName = account.bankName?.trim();
            if (!bankName)
               return <span className="text-muted-foreground">—</span>;
            return (
               <div className="flex min-w-0 items-center gap-2">
                  <BankLogoAvatar
                     bankCode={account.bankCode}
                     bankName={account.bankName}
                     color={account.color}
                     logoDevToken={logoDevToken}
                     name={bankName}
                     size="md"
                  />
                  <span className="truncate font-medium">{bankName}</span>
               </div>
            );
         },
      },
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            filterVariant: "text",
            cellComponent: "text" as const,
            isEditable: canRenameAccount,
            editMode: "inline" as const,
            required: true,
            editSchema: z
               .string()
               .trim()
               .min(2, "Nome deve ter no mínimo 2 caracteres."),
         },
         cell: ({ row }) => {
            const account = row.original;
            if (canRenameAccount && options?.onRenameAccount) {
               return (
                  <InlineEditText
                     ariaLabel="Nome"
                     onSave={async (value) => {
                        const next = value.trim();
                        if (!next || next === account.name) return;
                        await options.onRenameAccount?.(account.id, next);
                     }}
                     placeholder="—"
                     value={account.name}
                  />
               );
            }
            return <span className="font-medium truncate">{account.name}</span>;
         },
      },
      {
         accessorKey: "currentBalance",
         header: "Saldo Atual",
         cell: ({ row }) => {
            const parsedBalance = Number(row.original.currentBalance);
            const balance = Number.isFinite(parsedBalance) ? parsedBalance : 0;
            return (
               <Announcement>
                  <AnnouncementTag
                     className={`flex items-center ${
                        balance >= 0
                           ? "text-green-600 dark:text-green-500"
                           : "text-destructive"
                     }`}
                  >
                     <CircleDollarSign className="size-3" />
                  </AnnouncementTag>
                  <AnnouncementTitle
                     className={`font-medium ${
                        balance >= 0
                           ? "text-green-600 dark:text-green-500"
                           : "text-destructive"
                     }`}
                  >
                     {formatBRL(row.original.currentBalance)}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
      },
      {
         accessorKey: "projectedBalance",
         header: () => (
            <TooltipProvider>
               <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                     Saldo Previsto{" "}
                     <Info className="size-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                     Saldo atual + contas a receber pendentes - contas a pagar
                     pendentes
                  </TooltipContent>
               </Tooltip>
            </TooltipProvider>
         ),
         cell: ({ row }) => {
            const parsedBalance = Number(row.original.projectedBalance);
            const balance = Number.isFinite(parsedBalance) ? parsedBalance : 0;
            return (
               <Announcement>
                  <AnnouncementTag
                     className={`flex items-center ${
                        balance >= 0
                           ? "text-blue-600 dark:text-blue-400"
                           : "text-destructive"
                     }`}
                  >
                     <CalendarClock className="size-3" />
                  </AnnouncementTag>
                  <AnnouncementTitle
                     className={`font-medium ${
                        balance >= 0
                           ? "text-blue-600 dark:text-blue-400"
                           : "text-destructive"
                     }`}
                  >
                     {formatBRL(row.original.projectedBalance)}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         meta: {
            label: "Tipo",
            cellComponent: "select" as const,
            isEditable: canUpdateAccount,
            editMode: "inline" as const,
            bulkEditIcon: Shapes,
            bulkEditAction: "Alterar tipo",
            editOptions: TYPE_OPTIONS,
            filterVariant: "select",
            required: true,
         },
         cell: ({ row }) => {
            const parsed = typeSchema.safeParse(row.original.type);
            if (!parsed.success) {
               return (
                  <Announcement>
                     <AnnouncementTitle className="text-destructive">
                        Tipo inválido
                     </AnnouncementTitle>
                  </Announcement>
               );
            }
            if (canUpdateAccount && options?.onUpdateAccount) {
               return (
                  <InlineEditSelect
                     ariaLabel="Tipo"
                     onSave={async (value) => {
                        if (value === row.original.type) return;
                        await options.onUpdateAccount?.(row.original.id, {
                           type: value,
                        });
                     }}
                     options={TYPE_OPTIONS}
                     value={parsed.data}
                  />
               );
            }
            return (
               <Announcement>
                  <AnnouncementTag className="flex items-center">
                     {TYPE_ICONS[parsed.data]}
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {TYPE_LABELS[parsed.data]}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
      },
      {
         accessorKey: "initialBalance",
         header: "Saldo Inicial",
         meta: {
            label: "Saldo Inicial",
            cellComponent: "money" as const,
            isEditable: canUpdateAccount,
            editMode: "inline" as const,
            bulkEditIcon: CircleDollarSign,
            bulkEditAction: "Alterar saldo inicial",
         },
         cell: ({ row }) => {
            if (canUpdateAccount && options?.onUpdateAccount) {
               const numeric = Number(row.original.initialBalance) || 0;
               return (
                  <InlineEditMoney
                     ariaLabel="Saldo Inicial"
                     onSave={async (value) => {
                        const next = String(value);
                        if (next === row.original.initialBalance) return;
                        await options.onUpdateAccount?.(row.original.id, {
                           initialBalance: next,
                        });
                     }}
                     value={numeric}
                     valueInCents={false}
                  />
               );
            }
            return (
               <Announcement>
                  <AnnouncementTag className="flex items-center text-muted-foreground">
                     <CircleDollarSign className="size-3" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-muted-foreground">
                     {formatBRL(row.original.initialBalance)}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
      },
   ];
}

export { formatBRL, TYPE_LABELS };
