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
   ArrowLeftRight,
   ArrowUpRight,
   ChevronDown,
   Edit,
   Eye,
   Trash2,
} from "lucide-react";

import { DynamicIcon } from "@/features/icon-selector/dynamic-icon";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import type { Category } from "@/pages/categories/ui/categories-page";
import { ManageCategoryForm } from "../features/manage-category-form";
import { useDeleteCategory } from "../features/use-delete-category";

function CategoryActionsCell({ category }: { category: Category }) {
   const { activeOrganization } = useActiveOrganization();
   const { deleteCategory } = useDeleteCategory({ category });
   const { openSheet } = useSheet();

   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        categoryId: category.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/categories/$categoryId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  onClick={() =>
                     openSheet({
                        children: <ManageCategoryForm category={category} />,
                     })
                  }
                  size="icon"
                  variant="outline"
               >
                  <Edit className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Editar categoria</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={deleteCategory}
                  size="icon"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir categoria</TooltipContent>
         </Tooltip>
      </div>
   );
}

const _TRANSACTION_TYPE_CONFIG = {
   expense: {
      color: "#ef4444",
      icon: ArrowUpRight,
      label: "Despesa",
   },
   income: {
      color: "#10b981",
      icon: ArrowDownLeft,
      label: "Receita",
   },
   transfer: {
      color: "#3b82f6",
      icon: ArrowLeftRight,
      label: "Transferência",
   },
};

export function createCategoryColumns(_slug: string): ColumnDef<Category>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const category = row.original;
            return (
               <div className="flex items-center gap-3">
                  <div
                     className="size-8 rounded-sm flex items-center justify-center"
                     style={{ backgroundColor: `${category.color}20` }}
                  >
                     <DynamicIcon
                        name={category.icon ?? "FolderOpen"}
                        style={{ color: category.color }}
                     />
                  </div>
                  <span className="font-medium">{category.name}</span>
               </div>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         cell: ({ row }) => <CategoryActionsCell category={row.original} />,
         header: "",
         id: "actions",
      },
   ];
}

interface CategoryExpandedContentProps {
   row: Row<Category>;
   income: number;
   expenses: number;
}

export function CategoryExpandedContent({
   row,
   income,
   expenses,
}: CategoryExpandedContentProps) {
   const category = row.original;
   const { activeOrganization } = useActiveOrganization();
   const isMobile = useIsMobile();
   const { deleteCategory } = useDeleteCategory({ category });
   const { openSheet } = useSheet();

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div className="flex items-center gap-2">
                  <ArrowDownLeft className="size-4 text-emerald-500" />
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Total de Receitas
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
                        Total de Despesas
                     </p>
                     <p className="text-sm font-medium text-destructive">
                        -{formatDecimalCurrency(expenses)}
                     </p>
                  </div>
               </div>
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
                        categoryId: category.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/categories/$categoryId"
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
                        children: <ManageCategoryForm category={category} />,
                     });
                  }}
                  size="sm"
                  variant="outline"
               >
                  <Edit className="size-4" />
                  Editar categoria
               </Button>
               <Button
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={deleteCategory}
                  size="sm"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
                  Excluir categoria
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
                     Total de Receitas
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
                     Total de Despesas
                  </p>
                  <p className="text-sm font-medium text-destructive">
                     -{formatDecimalCurrency(expenses)}
                  </p>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{
                     categoryId: category.id,
                     slug: activeOrganization.slug,
                  }}
                  to="/$slug/categories/$categoryId"
               >
                  <Eye className="size-4" />
                  Ver detalhes
               </Link>
            </Button>
            <Button
               onClick={(e) => {
                  e.stopPropagation();
                  openSheet({
                     children: <ManageCategoryForm category={category} />,
                  });
               }}
               size="sm"
               variant="outline"
            >
               <Edit className="size-4" />
               Editar categoria
            </Button>
            <Button onClick={deleteCategory} size="sm" variant="destructive">
               <Trash2 className="size-4" />
               Excluir categoria
            </Button>
         </div>
      </div>
   );
}

interface CategoryMobileCardProps {
   row: Row<Category>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   income: number;
   expenses: number;
}

export function CategoryMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: CategoryMobileCardProps) {
   const category = row.original;

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               <div
                  className="size-10 rounded-sm flex items-center justify-center"
                  style={{ backgroundColor: `${category.color}20` }}
               >
                  <DynamicIcon
                     className="size-5"
                     name={category.icon ?? "FolderOpen"}
                     style={{ color: category.color }}
                  />
               </div>
               <div>
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <CardDescription />
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
