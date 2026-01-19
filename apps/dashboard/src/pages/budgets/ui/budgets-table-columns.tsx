import type { RouterOutput } from "@packages/api/client";
import { formatDecimalCurrency } from "@packages/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   Calendar,
   CheckCircle,
   CircleDashed,
   Power,
   RefreshCw,
   Target,
   TrendingDown,
   TrendingUp,
   Wallet,
} from "lucide-react";
import { EntityActions, ViewDetailsButton } from "@/components/entity-actions";
import { EntityExpandedContent } from "@/components/entity-expanded-content";
import { EntityMobileCard } from "@/components/entity-mobile-card";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { ManageBudgetForm } from "../features/manage-budget-form";
import { useDeleteBudget } from "../features/use-delete-budget";
import { useToggleBudgetStatus } from "../features/use-toggle-budget-status";

type Budget = RouterOutput["budgets"]["getAllPaginated"]["budgets"][0];

const periodLabels: Record<string, string> = {
   custom: "Personalizado",
   daily: "Diário",
   monthly: "Mensal",
   quarterly: "Trimestral",
   weekly: "Semanal",
   yearly: "Anual",
};

const regimeLabels: Record<string, string> = {
   accrual: "Regime de competência",
   cash: "Regime de caixa",
};

export function createBudgetColumns(): ColumnDef<Budget>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const budget = row.original;
            return (
               <Announcement>
                  <AnnouncementTag
                     className="flex items-center justify-center font-semibold text-xs text-white"
                     style={{ backgroundColor: budget.color || "#6366f1" }}
                  >
                     {budget.name.substring(0, 2).toUpperCase()}
                  </AnnouncementTag>
                  <AnnouncementTitle className="font-medium">
                     {budget.name}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         accessorKey: "amount",
         cell: ({ row }) => {
            const amount = parseFloat(row.getValue("amount"));
            return (
               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Wallet className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="font-medium">
                     {formatDecimalCurrency(amount)}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: true,
         header: "Valor",
      },
      {
         accessorKey: "progress",
         cell: ({ row }) => {
            const budget = row.original;
            const totalAmount = parseFloat(budget.amount);
            const currentPeriod = budget.periods?.[0];
            const spent = currentPeriod
               ? parseFloat(currentPeriod.spentAmount || "0")
               : 0;
            const percentage =
               totalAmount > 0 ? (spent / totalAmount) * 100 : 0;
            const isOverBudget = percentage >= 100;
            const isNearLimit = percentage >= 80 && percentage < 100;

            const TrendIcon = isOverBudget ? TrendingDown : TrendingUp;
            const trendColor = isOverBudget
               ? "#ef4444"
               : isNearLimit
                 ? "#eab308"
                 : "#10b981";

            return (
               <Announcement>
                  <AnnouncementTag
                     className="flex items-center gap-1.5"
                     style={{
                        backgroundColor: `${trendColor}20`,
                        color: trendColor,
                     }}
                  >
                     <TrendIcon className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {Math.round(percentage)}% - {formatDecimalCurrency(spent)}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         header: "Progresso",
      },
      {
         accessorKey: "isActive",
         cell: ({ row }) => {
            const isActive = row.getValue("isActive") as boolean;
            const StatusIcon = isActive ? CheckCircle : CircleDashed;
            const statusColor = isActive ? "#10b981" : "#6b7280";

            return (
               <Announcement>
                  <AnnouncementTag
                     className="flex items-center gap-1.5"
                     style={{
                        backgroundColor: `${statusColor}20`,
                        color: statusColor,
                     }}
                  >
                     <StatusIcon className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {isActive ? "Ativo" : "Inativo"}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: true,
         header: "Status",
      },
      {
         cell: ({ row }) => {
            const budget = row.original;
            const { activeOrganization } = useActiveOrganization();
            return (
               <ViewDetailsButton
                  detailsLink={{
                     params: {
                        budgetId: budget.id,
                        slug: activeOrganization.slug,
                     },
                     to: "/$slug/budgets/$budgetId",
                  }}
               />
            );
         },
         header: "",
         id: "actions",
      },
   ];
}

interface BudgetExpandedContentProps {
   row: Row<Budget>;
}

export function BudgetExpandedContent({ row }: BudgetExpandedContentProps) {
   const budget = row.original;
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { deleteBudget } = useDeleteBudget({ budget });
   const { isUpdating, toggleStatus } = useToggleBudgetStatus({ budget });
   const isMobile = useIsMobile();

   const totalAmount = parseFloat(budget.amount);
   const currentPeriod = budget.periods?.[0];
   const spent = currentPeriod
      ? parseFloat(currentPeriod.spentAmount || "0")
      : 0;
   const scheduled = currentPeriod
      ? parseFloat(currentPeriod.scheduledAmount || "0")
      : 0;
   const available = Math.max(0, totalAmount - spent - scheduled);
   const percentage = totalAmount > 0 ? (spent / totalAmount) * 100 : 0;

   const rolloverColor = budget.rollover ? "#3b82f6" : "#6b7280";

   const detailsLink = {
      params: {
         budgetId: budget.id,
         slug: activeOrganization.slug,
      },
      to: "/$slug/budgets/$budgetId" as const,
   };

   const handleEdit = () => {
      openSheet({
         children: <ManageBudgetForm budget={budget} />,
      });
   };

   const statusToggleElement = (
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
         {budget.isActive ? "Ativo" : "Inativo"}
      </Button>
   );

   const announcementsContent = (
      <div className="flex flex-wrap items-center gap-2">
         <Announcement>
            <AnnouncementTag className="flex items-center gap-1.5">
               <Calendar className="size-3.5" />
            </AnnouncementTag>
            <AnnouncementTitle>
               {periodLabels[budget.periodType]}
            </AnnouncementTitle>
         </Announcement>

         <Announcement>
            <AnnouncementTag
               className="flex items-center gap-1.5"
               style={{
                  backgroundColor: `${rolloverColor}20`,
                  color: rolloverColor,
               }}
            >
               <RefreshCw className="size-3.5" />
            </AnnouncementTag>
            <AnnouncementTitle>
               {budget.rollover ? "Rollover ativo" : "Sem rollover"}
            </AnnouncementTitle>
         </Announcement>

         <Announcement>
            <AnnouncementTag>Regime</AnnouncementTag>
            <AnnouncementTitle>
               {regimeLabels[budget.regime] ?? budget.regime}
            </AnnouncementTitle>
         </Announcement>

         <div className="h-4 w-px bg-border" />

         <Announcement>
            <AnnouncementTag className="flex items-center gap-1.5">
               <Target className="size-3.5" />
               Total
            </AnnouncementTag>
            <AnnouncementTitle>
               {formatDecimalCurrency(totalAmount)}
            </AnnouncementTitle>
         </Announcement>

         <Announcement>
            <AnnouncementTag
               className="flex items-center gap-1.5"
               style={{
                  backgroundColor: "#ef444420",
                  color: "#ef4444",
               }}
            >
               <TrendingUp className="size-3.5" />
               Gasto
            </AnnouncementTag>
            <AnnouncementTitle>
               {formatDecimalCurrency(spent)} ({Math.round(percentage)}%)
            </AnnouncementTitle>
         </Announcement>

         <Announcement>
            <AnnouncementTag
               className="flex items-center gap-1.5"
               style={{
                  backgroundColor: "#10b98120",
                  color: "#10b981",
               }}
            >
               <Wallet className="size-3.5" />
               Disponível
            </AnnouncementTag>
            <AnnouncementTitle>
               {formatDecimalCurrency(available)}
            </AnnouncementTitle>
         </Announcement>
      </div>
   );

   const mobileAnnouncementsContent = (
      <div className="space-y-4">
         <div className="flex flex-wrap items-center gap-2">
            <Announcement>
               <AnnouncementTag className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
               </AnnouncementTag>
               <AnnouncementTitle>
                  {periodLabels[budget.periodType]}
               </AnnouncementTitle>
            </Announcement>

            <Announcement>
               <AnnouncementTag
                  className="flex items-center gap-1.5"
                  style={{
                     backgroundColor: `${rolloverColor}20`,
                     color: rolloverColor,
                  }}
               >
                  <RefreshCw className="size-3.5" />
               </AnnouncementTag>
               <AnnouncementTitle>
                  {budget.rollover ? "Rollover ativo" : "Sem rollover"}
               </AnnouncementTitle>
            </Announcement>

            <Announcement>
               <AnnouncementTag>Regime</AnnouncementTag>
               <AnnouncementTitle>
                  {regimeLabels[budget.regime] ?? budget.regime}
               </AnnouncementTitle>
            </Announcement>
         </div>

         <div className="flex flex-wrap items-center gap-2">
            <Announcement>
               <AnnouncementTag className="flex items-center gap-1.5">
                  <Target className="size-3.5" />
                  Total
               </AnnouncementTag>
               <AnnouncementTitle>
                  {formatDecimalCurrency(totalAmount)}
               </AnnouncementTitle>
            </Announcement>

            <Announcement>
               <AnnouncementTag
                  className="flex items-center gap-1.5"
                  style={{
                     backgroundColor: "#ef444420",
                     color: "#ef4444",
                  }}
               >
                  <TrendingUp className="size-3.5" />
                  Gasto
               </AnnouncementTag>
               <AnnouncementTitle>
                  {formatDecimalCurrency(spent)} ({Math.round(percentage)}%)
               </AnnouncementTitle>
            </Announcement>

            <Announcement>
               <AnnouncementTag
                  className="flex items-center gap-1.5"
                  style={{
                     backgroundColor: "#10b98120",
                     color: "#10b981",
                  }}
               >
                  <Wallet className="size-3.5" />
                  Disponível
               </AnnouncementTag>
               <AnnouncementTitle>
                  {formatDecimalCurrency(available)}
               </AnnouncementTitle>
            </Announcement>
         </div>
      </div>
   );

   if (isMobile) {
      return (
         <EntityExpandedContent
            actions={
               <div className="space-y-2">
                  {statusToggleElement}
                  <EntityActions
                     detailsLink={detailsLink}
                     labels={{
                        delete: "Excluir orçamento",
                        edit: "Editar orçamento",
                     }}
                     onDelete={deleteBudget}
                     onEdit={handleEdit}
                     variant="mobile"
                  />
               </div>
            }
         >
            {mobileAnnouncementsContent}
         </EntityExpandedContent>
      );
   }

   return (
      <EntityExpandedContent
         actions={
            <div className="flex items-center gap-2">
               {statusToggleElement}
               <EntityActions
                  detailsLink={detailsLink}
                  labels={{
                     delete: "Excluir",
                     edit: "Editar",
                  }}
                  onDelete={deleteBudget}
                  onEdit={handleEdit}
                  variant="full"
               />
            </div>
         }
      >
         {announcementsContent}
      </EntityExpandedContent>
   );
}

interface BudgetMobileCardProps {
   row: Row<Budget>;
   isExpanded: boolean;
   toggleExpanded: () => void;
}

export function BudgetMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: BudgetMobileCardProps) {
   const budget = row.original;
   const totalAmount = parseFloat(budget.amount);
   const currentPeriod = budget.periods?.[0];
   const spent = currentPeriod
      ? parseFloat(currentPeriod.spentAmount || "0")
      : 0;
   const percentage = totalAmount > 0 ? (spent / totalAmount) * 100 : 0;

   return (
      <EntityMobileCard
         content={
            <>
               <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                     {formatDecimalCurrency(spent)} /{" "}
                     {formatDecimalCurrency(totalAmount)}
                  </span>
                  <span
                     className={`text-sm font-medium ${percentage >= 100 ? "text-destructive" : ""}`}
                  >
                     {Math.round(percentage)}%
                  </span>
               </div>
               <div className="flex gap-2 mt-3">
                  <Badge variant={budget.isActive ? "default" : "secondary"}>
                     {budget.isActive ? "Ativo" : "Inativo"}
                  </Badge>
               </div>
            </>
         }
         icon={
            <div
               className="size-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
               style={{ backgroundColor: budget.color || "#6366f1" }}
            >
               {budget.name.substring(0, 2).toUpperCase()}
            </div>
         }
         isExpanded={isExpanded}
         subtitle={periodLabels[budget.periodType]}
         title={budget.name}
         toggleExpanded={toggleExpanded}
      />
   );
}
