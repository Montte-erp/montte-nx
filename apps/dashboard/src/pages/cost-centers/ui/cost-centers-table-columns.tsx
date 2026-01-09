import { formatDecimalCurrency } from "@packages/money";
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
import { Separator } from "@packages/ui/components/separator";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   ArrowDownLeft,
   ArrowUpRight,
   Building2,
   ChevronDown,
   Edit,
   Eye,
   Hash,
   Trash2,
} from "lucide-react";

import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import type { CostCenter } from "@/pages/cost-centers/ui/cost-centers-page";
import { ManageCostCenterForm } from "../features/manage-cost-center-form";
import { useDeleteCostCenter } from "../features/use-delete-cost-center";

function CostCenterActionsCell({ costCenter }: { costCenter: CostCenter }) {
   const { activeOrganization } = useActiveOrganization();
   const { deleteCostCenter } = useDeleteCostCenter({ costCenter });
   const { openSheet } = useSheet();

   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        costCenterId: costCenter.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/cost-centers/$costCenterId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>
               Ver detalhes
            </TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  onClick={() =>
                     openSheet({
                        children: (
                           <ManageCostCenterForm costCenter={costCenter} />
                        ),
                     })
                  }
                  size="icon"
                  variant="outline"
               >
                  <Edit className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>
               Editar centro de custo
            </TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={deleteCostCenter}
                  size="icon"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>
               Excluir centro de custo
            </TooltipContent>
         </Tooltip>
      </div>
   );
}

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
         cell: ({ row }) => <CostCenterActionsCell costCenter={row.original} />,
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

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div className="flex items-center gap-2">
                  <ArrowDownLeft className="size-4 text-emerald-500" />
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Receita
                     </p>
                     <p className="text-sm font-medium text-emerald-500">
                        +{formatDecimalCurrency(income)}
                     </p>
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <ArrowUpRight className="size-4 text-destructive" />
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Despesas
                     </p>
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
                           <p className="text-xs text-muted-foreground">
                              Código
                           </p>
                           <p className="text-sm font-medium">
                              {costCenter.code}
                           </p>
                        </div>
                     </div>
                  </>
               )}
            </div>

            <Separator />

            <div className="space-y-2">
               <Button
                  asChild
                  className="w-full justify-start"
                  size="sm"
                  variant="outline"
               >
                  <Link
                     params={{
                        costCenterId: costCenter.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/cost-centers/$costCenterId"
                  >
                     <Eye className="size-4" />
                     Ver detalhes
                  </Link>
               </Button>
               <Button
                  className="w-full justify-start"
                  onClick={(e) => {
                     e.stopPropagation();
                     openSheet({
                        children: (
                           <ManageCostCenterForm costCenter={costCenter} />
                        ),
                     });
                  }}
                  size="sm"
                  variant="outline"
               >
                  <Edit className="size-4" />
                  Editar centro de custo
               </Button>
               <Button
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={deleteCostCenter}
                  size="sm"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
                  Excluir centro de custo
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="p-4 flex items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <ArrowDownLeft className="size-4 text-emerald-500" />
               <div>
                  <p className="text-xs text-muted-foreground">
                     Receita
                  </p>
                  <p className="text-sm font-medium text-emerald-500">
                     +{formatDecimalCurrency(income)}
                  </p>
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <ArrowUpRight className="size-4 text-destructive" />
               <div>
                  <p className="text-xs text-muted-foreground">
                     Despesas
                  </p>
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
                        <p className="text-xs text-muted-foreground">
                           Código
                        </p>
                        <p className="text-sm font-medium">{costCenter.code}</p>
                     </div>
                  </div>
               </>
            )}
         </div>

         <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{
                     costCenterId: costCenter.id,
                     slug: activeOrganization.slug,
                  }}
                  to="/$slug/cost-centers/$costCenterId"
               >
                  <Eye className="size-4" />
                  Ver detalhes
               </Link>
            </Button>
            <Button
               onClick={(e) => {
                  e.stopPropagation();
                  openSheet({
                     children: <ManageCostCenterForm costCenter={costCenter} />,
                  });
               }}
               size="sm"
               variant="outline"
            >
               <Edit className="size-4" />
               Editar centro de custo
            </Button>
            <Button onClick={deleteCostCenter} size="sm" variant="destructive">
               <Trash2 className="size-4" />
               Excluir centro de custo
            </Button>
         </div>
      </div>
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
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               <div className="size-10 rounded-sm flex items-center justify-center bg-muted">
                  <Building2 className="size-5" />
               </div>
               <div>
                  <CardTitle className="text-base">{costCenter.name}</CardTitle>
                  {costCenter.code && (
                     <CardDescription>{costCenter.code}</CardDescription>
                  )}
               </div>
            </div>
         </CardHeader>
         <CardContent />
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
                  {isExpanded ? "Menos info" : "Mais info"}
                  <ChevronDown
                     className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
               </Button>
            </CollapsibleTrigger>
         </CardFooter>
      </Card>
   );
}
