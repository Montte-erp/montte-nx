import { format, of } from "@f-o-t/money";
import { Avatar, AvatarFallback } from "@packages/ui/components/avatar";
import { Badge } from "@packages/ui/components/badge";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Banknote,
   Calendar,
   CalendarClock,
   CreditCard as CreditCardIcon,
   Landmark,
} from "lucide-react";
import { z } from "zod";
import type { Outputs } from "@/integrations/orpc/client";

export type CreditCardRow = Outputs["creditCards"]["getAll"]["data"][number];

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

const BRAND_LABEL: Record<string, string> = {
   visa: "Visa",
   mastercard: "Mastercard",
   elo: "Elo",
   amex: "Amex",
   hipercard: "Hipercard",
   other: "Outra",
};

const BRAND_COLOR: Record<string, string> = {
   visa: "#1A1F71",
   mastercard: "#EB001B",
   elo: "#000000",
   amex: "#2E77BC",
   hipercard: "#822124",
   other: "#6B7280",
};

function bankInitials(name: string): string {
   const parts = name.trim().split(/\s+/).filter(Boolean);
   if (parts.length === 0) return "?";
   if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
   return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
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

export function buildCreditCardColumns(options?: {
   bankAccounts?: Array<BankAccountOption>;
}): ColumnDef<CreditCardRow>[] {
   const bankAccountsById = new Map(
      (options?.bankAccounts ?? []).map((b) => [b.id, b] as const),
   );
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <div className="flex items-center gap-2 min-w-0">
               <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: row.original.color }}
               />
               <span className="font-medium truncate">{row.original.name}</span>
            </div>
         ),
         meta: {
            label: "Nome",
            cellComponent: "text" as const,
            editSchema: z.string().min(1, "Nome é obrigatório."),
         },
      },
      {
         accessorKey: "brand",
         header: "Bandeira",
         cell: ({ row }) => {
            const brand = row.original.brand;
            if (!brand) return <span className="text-muted-foreground">—</span>;
            const color = BRAND_COLOR[brand] ?? BRAND_COLOR.other!;
            return (
               <Announcement>
                  <AnnouncementTag
                     className="flex items-center text-white"
                     style={{ backgroundColor: color }}
                  >
                     <CreditCardIcon className="size-3" />
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {BRAND_LABEL[brand] ?? brand}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         meta: { label: "Bandeira" },
      },
      {
         accessorKey: "creditLimit",
         header: "Limite",
         cell: ({ row }) => (
            <Announcement>
               <AnnouncementTag className="flex items-center text-muted-foreground">
                  <Banknote className="size-3" />
               </AnnouncementTag>
               <AnnouncementTitle className="tabular-nums">
                  {formatBRL(row.original.creditLimit)}
               </AnnouncementTitle>
            </Announcement>
         ),
         meta: { label: "Limite" },
      },
      {
         accessorKey: "closingDay",
         header: "Fechamento",
         cell: ({ row }) => (
            <Announcement>
               <AnnouncementTag className="flex items-center text-muted-foreground">
                  <CalendarClock className="size-3" />
               </AnnouncementTag>
               <AnnouncementTitle>
                  Dia {row.original.closingDay}
               </AnnouncementTitle>
            </Announcement>
         ),
         meta: {
            label: "Fechamento",
            cellComponent: "text" as const,
            editSchema: z.coerce.number().int().min(1).max(31),
         },
      },
      {
         accessorKey: "dueDay",
         header: "Vencimento",
         cell: ({ row }) => (
            <Announcement>
               <AnnouncementTag className="flex items-center text-muted-foreground">
                  <Calendar className="size-3" />
               </AnnouncementTag>
               <AnnouncementTitle>Dia {row.original.dueDay}</AnnouncementTitle>
            </Announcement>
         ),
         meta: {
            label: "Vencimento",
            cellComponent: "text" as const,
            editSchema: z.coerce.number().int().min(1).max(31),
         },
      },
      {
         accessorKey: "bankAccountId",
         header: "Conta Bancária",
         cell: ({ row }) => {
            const account = bankAccountsById.get(row.original.bankAccountId);
            if (!account)
               return <span className="text-muted-foreground">—</span>;
            const issuer = account.bankName?.trim() || account.name;
            return (
               <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-6 shrink-0">
                     <AvatarFallback
                        className="text-[10px] font-semibold text-white"
                        style={{
                           backgroundColor: account.color ?? "#6366f1",
                        }}
                     >
                        {account.bankName ? (
                           bankInitials(account.bankName)
                        ) : (
                           <Landmark className="size-3" />
                        )}
                     </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                     <span className="text-sm truncate">{issuer}</span>
                     {account.bankCode ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                           {account.bankCode}
                        </span>
                     ) : null}
                  </div>
               </div>
            );
         },
         meta: {
            label: "Conta Bancária",
            cellComponent: "combobox" as const,
            importIgnore: true,
            editOptions: options?.bankAccounts?.map((a) => ({
               value: a.id,
               label: a.name,
            })),
         },
      },
      {
         accessorKey: "status",
         header: "Status",
         cell: ({ row }) => {
            const status = row.original.status as keyof typeof STATUS_LABEL;
            return (
               <Badge variant={STATUS_VARIANT[status] ?? "default"}>
                  {STATUS_LABEL[status] ?? status}
               </Badge>
            );
         },
         meta: { label: "Status", filterVariant: "select" },
      },
   ];
}
