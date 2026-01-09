import type { BankAccount } from "@packages/database/repositories/bank-account-repository";
import { formatDecimalCurrency } from "@packages/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { CollapsibleTrigger } from "@packages/ui/components/collapsible";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { formatDate } from "@packages/utils/date";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   ArrowDownLeft,
   ArrowUpRight,
   ChevronDown,
   Download,
   Edit,
   Eye,
   Landmark,
   PiggyBank,
   Power,
   PowerOff,
   Trash2,
   TrendingUp,
   Upload,
   Wallet,
} from "lucide-react";

function getAccountTypeIcon(type: string | null | undefined) {
   switch (type) {
      case "savings":
         return PiggyBank;
      case "investment":
         return TrendingUp;
      default:
         return Landmark;
   }
}

import { ManageBankAccountForm } from "@/features/bank-account/ui/manage-bank-account-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useDeleteBankAccount } from "@/pages/bank-account-details/features/use-delete-bank-account";
import { useToggleBankAccountStatus } from "@/pages/bank-accounts/features/use-toggle-bank-account-status";

function BankAccountActionsCell({ account }: { account: BankAccount }) {
   const { activeOrganization } = useActiveOrganization();

   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        bankAccountId: account.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/bank-accounts/$bankAccountId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes</TooltipContent>
         </Tooltip>
      </div>
   );
}

export function createBankAccountColumns(): ColumnDef<BankAccount>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const account = row.original;
            return (
               <div className="flex flex-col">
                  <span className="font-medium">{account.name}</span>
               </div>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         accessorKey: "bank",
         cell: ({ row }) => {
            return <span>{row.getValue("bank")}</span>;
         },
         enableSorting: true,
         header: "Banco",
      },
      {
         accessorKey: "type",
         cell: ({ row }) => {
            const account = row.original;
            const AccountTypeIcon = getAccountTypeIcon(account.type);
            return (
               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <AccountTypeIcon className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {typeMap[account.type] || account.type}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: true,
         header: "Tipo",
      },
      {
         accessorKey: "status",
         cell: ({ row }) => {
            const status = row.getValue("status") as string;
            const isActive = status === "active";
            const StatusIcon = isActive ? Power : PowerOff;
            const color = isActive ? "#10b981" : "#6b7280";

            return (
               <Announcement>
                  <AnnouncementTag
                     style={{
                        backgroundColor: `${color}20`,
                        color,
                     }}
                  >
                     <StatusIcon className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle style={{ color }}>
                     {isActive ? "Ativa" : "Inativa"}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: true,
         header: "Status",
      },
      {
         accessorKey: "createdAt",
         cell: ({ row }) => {
            return formatDate(
               new Date(row.getValue("createdAt")),
               "DD MMM YYYY",
            );
         },
         enableSorting: true,
         header: "Criado em",
      },
      {
         cell: ({ row }) => <BankAccountActionsCell account={row.original} />,
         header: "",
         id: "actions",
      },
   ];
}

const typeMap: Record<string, string> = {
   checking: "Conta corrente",
   investment: "Conta de investimento",
   savings: "Conta poupança",
};

interface BankAccountExpandedContentProps {
   row: Row<BankAccount>;
   balance: number;
   income: number;
   expenses: number;
}

export function BankAccountExpandedContent({
   row,
   balance,
   income,
   expenses,
}: BankAccountExpandedContentProps) {
   const account = row.original;
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { canDelete, deleteBankAccount } = useDeleteBankAccount({
      bankAccount: account,
   });
   const { toggleStatus, isUpdating } = useToggleBankAccountStatus({
      bankAccount: account,
   });

   const handleEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      openSheet({
         children: <ManageBankAccountForm bankAccount={account} />,
      });
   };

   const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteBankAccount();
   };

   // Common stats row for both mobile and desktop
   const statsRow = (
      <div className="flex flex-wrap items-center gap-2">
         <Announcement>
            <AnnouncementTag className="flex items-center gap-1.5">
               <Wallet className="size-3.5" />
               Saldo Atual
            </AnnouncementTag>
            <AnnouncementTitle>
               {formatDecimalCurrency(balance)}
            </AnnouncementTitle>
         </Announcement>

         <div className="h-4 w-px bg-border" />

         <Announcement>
            <AnnouncementTag className="flex items-center gap-1.5">
               <ArrowDownLeft className="size-3.5 text-emerald-500" />
               Total de Receitas
            </AnnouncementTag>
            <AnnouncementTitle className="text-emerald-500">
               +{formatDecimalCurrency(income)}
            </AnnouncementTitle>
         </Announcement>

         <div className="h-4 w-px bg-border" />

         <Announcement>
            <AnnouncementTag className="flex items-center gap-1.5">
               <ArrowUpRight className="size-3.5 text-destructive" />
               Total de Despesas
            </AnnouncementTag>
            <AnnouncementTitle className="text-destructive">
               -{formatDecimalCurrency(expenses)}
            </AnnouncementTitle>
         </Announcement>
      </div>
   );

   // Common actions row for both mobile and desktop
   const actionsRow = (
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
         <Button
            disabled={isUpdating}
            onClick={(e) => {
               e.stopPropagation();
               toggleStatus();
            }}
            size="sm"
            variant="outline"
         >
            <Power className="size-4" />
            {account.status === "active" ? "Desativar" : "Ativar"}
         </Button>
         <Button asChild size="sm" variant="outline">
            <Link
               params={{
                  bankAccountId: account.id,
                  slug: activeOrganization.slug,
               }}
               to="/$slug/bank-accounts/$bankAccountId"
            >
               <Eye className="size-4" />
               Ver detalhes
            </Link>
         </Button>
         <Button asChild size="sm" variant="outline">
            <Link
               params={{
                  slug: activeOrganization.slug,
               }}
               search={{ bankAccountId: account.id }}
               to="/$slug/import"
            >
               <Upload className="size-4" />
               Importar Extrato
            </Link>
         </Button>
         <Button asChild size="sm" variant="outline">
            <Link
               params={{
                  slug: activeOrganization.slug,
               }}
               search={{ bankAccountId: account.id }}
               to="/$slug/export"
            >
               <Download className="size-4" />
               Exportar Extrato
            </Link>
         </Button>
         <Button onClick={handleEdit} size="sm" variant="outline">
            <Edit className="size-4" />
            Editar
         </Button>
         <Button
            disabled={!canDelete}
            onClick={handleDelete}
            size="sm"
            variant="destructive"
         >
            <Trash2 className="size-4" />
            Excluir
         </Button>
      </div>
   );

   return (
      <div className="p-4 space-y-4">
         {statsRow}
         {actionsRow}
      </div>
   );
}

interface BankAccountMobileCardProps {
   row: Row<BankAccount>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   balance: number;
   income: number;
   expenses: number;
}

export function BankAccountMobileCard({
   row,
   isExpanded,
   toggleExpanded,
   balance,
}: BankAccountMobileCardProps) {
   const account = row.original;
   const isActive = account.status === "active";
   const StatusIcon = isActive ? Power : PowerOff;
   const statusColor = isActive ? "#10b981" : "#6b7280";
   const AccountTypeIcon = getAccountTypeIcon(account.type);

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <CardDescription>{account.name}</CardDescription>
            <CardTitle>{account.bank}</CardTitle>
            <CardDescription>
               <Badge variant="outline">{formatDecimalCurrency(balance)}</Badge>
            </CardDescription>
         </CardHeader>
         <CardContent className="flex flex-wrap items-center gap-2">
            <Announcement>
               <AnnouncementTag
                  style={{
                     backgroundColor: `${statusColor}20`,
                     color: statusColor,
                  }}
               >
                  <StatusIcon className="size-3.5" />
               </AnnouncementTag>
               <AnnouncementTitle style={{ color: statusColor }}>
                  {isActive ? "Ativa" : "Inativa"}
               </AnnouncementTitle>
            </Announcement>
            <Announcement>
               <AnnouncementTag className="flex items-center gap-1.5">
                  <AccountTypeIcon className="size-3.5" />
               </AnnouncementTag>
               <AnnouncementTitle>
                  {typeMap[account.type] || account.type}
               </AnnouncementTitle>
            </Announcement>
         </CardContent>
         <CardFooter>
            <CollapsibleTrigger asChild>
               <Button
                  className="w-full"
                  onClick={(e) => {
                     e.stopPropagation();
                     toggleExpanded();
                  }}
                  variant="outline"
               >
                  {isExpanded ? "Menos informações" : "Mais informações"}
                  <ChevronDown
                     className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
               </Button>
            </CollapsibleTrigger>
         </CardFooter>
      </Card>
   );
}
