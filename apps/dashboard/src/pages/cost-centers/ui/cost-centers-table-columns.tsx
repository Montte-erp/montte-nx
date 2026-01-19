import { formatDecimalCurrency } from "@packages/money";
import { Separator } from "@packages/ui/components/separator";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight, Building2, Hash } from "lucide-react";

import { EntityActions, ViewDetailsButton } from "@/components/entity-actions";
import { ResponsiveEntityExpandedContent } from "@/components/entity-expanded-content";
import { EntityMobileCard } from "@/components/entity-mobile-card";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import type { CostCenter } from "@/pages/cost-centers/ui/cost-centers-page";
import { ManageCostCenterForm } from "../features/manage-cost-center-form";
import { useDeleteCostCenter } from "../features/use-delete-cost-center";

export function createCostCenterColumns(
   _slug: string,
): ColumnDef<CostCenter>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const costCenter = row.original;
            return (
               <div className="flex items-center gap-3">
                  <div className="size-8 rounded-sm flex items-center justify-center bg-muted">
                     <Building2 className="size-4" />
                  </div>
                  <div className="flex flex-col">
                     <span className="font-medium">{costCenter.name}</span>
                     {costCenter.code && (
                        <span className="text-xs text-muted-foreground">
                           {costCenter.code}
                        </span>
                     )}
                  </div>
               </div>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         accessorKey: "code",
         cell: ({ row }) => {
            const costCenter = row.original;
            return (
               <span className="text-muted-foreground">
                  {costCenter.code || "-"}
               </span>
            );
         },
         enableSorting: true,
         header: "Código",
      },
      {
         cell: ({ row }) => {
            const costCenter = row.original;
            const { activeOrganization } = useActiveOrganization();
            return (
               <ViewDetailsButton
                  detailsLink={{
                     params: {
                        costCenterId: costCenter.id,
                        slug: activeOrganization.slug,
                     },
                     to: "/$slug/cost-centers/$costCenterId",
                  }}
               />
            );
         },
         header: "",
         id: "actions",
      },
   ];
}

interface CostCenterExpandedContentProps {
   row: Row<CostCenter>;
   income: number;
   expenses: number;
}

export function CostCenterExpandedContent({
   row,
   income,
   expenses,
}: CostCenterExpandedContentProps) {
   const costCenter = row.original;
   const { activeOrganization } = useActiveOrganization();
   const isMobile = useIsMobile();
   const { deleteCostCenter } = useDeleteCostCenter({ costCenter });
   const { openSheet } = useSheet();

   const detailsLink = {
      params: {
         costCenterId: costCenter.id,
         slug: activeOrganization.slug,
      },
      to: "/$slug/cost-centers/$costCenterId" as const,
   };

   const handleEdit = () => {
      openSheet({
         children: <ManageCostCenterForm costCenter={costCenter} />,
      });
   };

   const mobileContent = (
      <div className="space-y-3">
         <div className="flex items-center gap-2">
            <ArrowDownLeft className="size-4 text-emerald-500" />
            <div>
               <p className="text-xs text-muted-foreground">Receita</p>
               <p className="text-sm font-medium text-emerald-500">
                  +{formatDecimalCurrency(income)}
               </p>
            </div>
         </div>
         <Separator />
         <div className="flex items-center gap-2">
            <ArrowUpRight className="size-4 text-destructive" />
            <div>
               <p className="text-xs text-muted-foreground">Despesas</p>
               <p className="text-sm font-medium text-destructive">
                  -{formatDecimalCurrency(expenses)}
               </p>
            </div>
         </div>
         {costCenter.code && (
            <>
               <Separator />
               <div className="flex items-center gap-2">
                  <Hash className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Código</p>
                     <p className="text-sm font-medium">{costCenter.code}</p>
                  </div>
               </div>
            </>
         )}
      </div>
   );

   const desktopContent = (
      <div className="flex items-center gap-6">
         <div className="flex items-center gap-2">
            <ArrowDownLeft className="size-4 text-emerald-500" />
            <div>
               <p className="text-xs text-muted-foreground">Receita</p>
               <p className="text-sm font-medium text-emerald-500">
                  +{formatDecimalCurrency(income)}
               </p>
            </div>
         </div>
         <Separator className="h-8" orientation="vertical" />
         <div className="flex items-center gap-2">
            <ArrowUpRight className="size-4 text-destructive" />
            <div>
               <p className="text-xs text-muted-foreground">Despesas</p>
               <p className="text-sm font-medium text-destructive">
                  -{formatDecimalCurrency(expenses)}
               </p>
            </div>
         </div>
         {costCenter.code && (
            <>
               <Separator className="h-8" orientation="vertical" />
               <div className="flex items-center gap-2">
                  <Hash className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Código</p>
                     <p className="text-sm font-medium">{costCenter.code}</p>
                  </div>
               </div>
            </>
         )}
      </div>
   );

   return (
      <ResponsiveEntityExpandedContent
         desktopActions={
            <EntityActions
               detailsLink={detailsLink}
               labels={{
                  edit: "Editar centro de custo",
                  delete: "Excluir centro de custo",
               }}
               onDelete={deleteCostCenter}
               onEdit={handleEdit}
               variant="full"
            />
         }
         desktopContent={desktopContent}
         isMobile={isMobile}
         mobileActions={
            <EntityActions
               detailsLink={detailsLink}
               labels={{
                  edit: "Editar centro de custo",
                  delete: "Excluir centro de custo",
               }}
               onDelete={deleteCostCenter}
               onEdit={handleEdit}
               variant="mobile"
            />
         }
         mobileContent={mobileContent}
      />
   );
}

interface CostCenterMobileCardProps {
   row: Row<CostCenter>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   income: number;
   expenses: number;
}

export function CostCenterMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: CostCenterMobileCardProps) {
   const costCenter = row.original;

   return (
      <EntityMobileCard
         icon={
            <div className="size-10 rounded-sm flex items-center justify-center bg-muted">
               <Building2 className="size-5" />
            </div>
         }
         isExpanded={isExpanded}
         subtitle={costCenter.code}
         title={costCenter.name}
         toggleExpanded={toggleExpanded}
      />
   );
}
