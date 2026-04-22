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
   TrendingUp,
   Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";

export type BankAccountRow = {
   id: string;
   teamId: string;
   name: string;
   type: "checking" | "savings" | "investment" | "payment" | "cash";
   color: string;
   iconUrl?: string | null;
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

const TYPE_EDIT_OPTIONS = [
   { value: "checking", label: "Conta Corrente" },
   { value: "savings", label: "Conta Poupança" },
   { value: "investment", label: "Conta Investimento" },
   { value: "payment", label: "Conta Pagamento" },
   { value: "cash", label: "Caixa Físico" },
];

const TYPE_ICONS: Record<BankAccountRow["type"], ReactNode> = {
   cash: <Wallet className="size-3" />,
   checking: <Landmark className="size-3" />,
   savings: <PiggyBank className="size-3" />,
   payment: <CreditCard className="size-3" />,
   investment: <TrendingUp className="size-3" />,
};

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

export function buildBankAccountColumns(): ColumnDef<BankAccountRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            cellComponent: "text" as const,
            editSchema: z.string().min(1, "Nome é obrigatório."),
         },
         cell: ({ row }) => (
            <span className="font-medium truncate">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "currentBalance",
         header: "Saldo Atual",
         cell: ({ row }) => {
            const balance = Number(row.original.currentBalance);
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
            const balance = Number(row.original.projectedBalance);
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
            editOptions: TYPE_EDIT_OPTIONS,
            editSchema: z.enum([
               "checking",
               "savings",
               "investment",
               "payment",
               "cash",
            ]),
         },
         cell: ({ row }) => (
            <Announcement>
               <AnnouncementTag className="flex items-center">
                  {TYPE_ICONS[row.original.type]}
               </AnnouncementTag>
               <AnnouncementTitle>
                  {TYPE_LABELS[row.original.type]}
               </AnnouncementTitle>
            </Announcement>
         ),
      },
      {
         accessorKey: "initialBalance",
         header: "Saldo Inicial",
         cell: ({ row }) => (
            <Announcement>
               <AnnouncementTag className="flex items-center text-muted-foreground">
                  <CircleDollarSign className="size-3" />
               </AnnouncementTag>
               <AnnouncementTitle className="text-muted-foreground">
                  {formatBRL(row.original.initialBalance)}
               </AnnouncementTitle>
            </Announcement>
         ),
      },
   ];
}

export { formatBRL, TYPE_LABELS };
