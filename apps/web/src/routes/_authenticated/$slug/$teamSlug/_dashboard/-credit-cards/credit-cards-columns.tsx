import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, Calendar, CalendarClock } from "lucide-react";
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
   bankAccounts?: Array<{ id: string; name: string }>;
}): ColumnDef<CreditCardRow>[] {
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
            return (
               <span className="text-sm">{BRAND_LABEL[brand] ?? brand}</span>
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
         cell: () => <span className="text-muted-foreground">—</span>,
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
