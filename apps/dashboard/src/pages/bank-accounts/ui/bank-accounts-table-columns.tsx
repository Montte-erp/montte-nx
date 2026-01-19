import type { BankAccount } from "@packages/database/repositories/bank-account-repository";
import { formatDecimalCurrency } from "@packages/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { formatDate } from "@packages/utils/date";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   ArrowDownLeft,
   ArrowUpRight,
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

import { ViewDetailsButton } from "@/components/entity-actions";
import { EntityMobileCard } from "@/components/entity-mobile-card";
import { ManageBankAccountForm } from "@/features/bank-account/ui/manage-bank-account-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useDeleteBankAccount } from "@/pages/bank-account-details/features/use-delete-bank-account";
import { useToggleBankAccountStatus } from "@/pages/bank-accounts/features/use-toggle-bank-account-status";

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
         cell: ({ row }) => {
            const account = row.original;
            const { activeOrganization } = useActiveOrganization();
            return (
               <ViewDetailsButton
                  detailsLink={{
                     params: {
                        bankAccountId: account.id,
                        slug: activeOrganization.slug,
                     },
                     to: "/$slug/bank-accounts/$bankAccountId",
                  }}
               />
            );
         },
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

   // Bank accounts have custom actions (Import/Export, Status toggle) that don't fit EntityActions
   // We keep the existing pattern but use proper structure
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
      <EntityMobileCard
         content={
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
         }
         icon={
            <div className="size-10 rounded-sm flex items-center justify-center bg-muted">
               <Landmark className="size-5" />
            </div>
         }
         isExpanded={isExpanded}
         subtitle={
            <Badge variant="outline">{formatDecimalCurrency(balance)}</Badge>
         }
         title={account.bank ?? account.name}
         toggleExpanded={toggleExpanded}
      />
   );
}
