import { formatDecimalCurrency } from "@packages/money";
import { Separator } from "@packages/ui/components/separator";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { EntityActions, ViewDetailsButton } from "@/components/entity-actions";
import { ResponsiveEntityExpandedContent } from "@/components/entity-expanded-content";
import { EntityMobileCard } from "@/components/entity-mobile-card";
import { DynamicIcon } from "@/features/icon-selector/dynamic-icon";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import type { Category } from "@/pages/categories/ui/categories-page";
import { ManageCategoryForm } from "../features/manage-category-form";
import { useDeleteCategory } from "../features/use-delete-category";

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
         cell: ({ row }) => {
            const category = row.original;
            const { activeOrganization } = useActiveOrganization();
            return (
               <ViewDetailsButton
                  detailsLink={{
                     params: {
                        categoryId: category.id,
                        slug: activeOrganization.slug,
                     },
                     to: "/$slug/categories/$categoryId",
                  }}
               />
            );
         },
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

   const detailsLink = {
      params: {
         categoryId: category.id,
         slug: activeOrganization.slug,
      },
      to: "/$slug/categories/$categoryId" as const,
   };

   const handleEdit = () => {
      openSheet({
         children: <ManageCategoryForm category={category} />,
      });
   };

   const mobileContent = (
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
   );

   const desktopContent = (
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
   );

   return (
      <ResponsiveEntityExpandedContent
         desktopActions={
            <EntityActions
               detailsLink={detailsLink}
               labels={{
                  edit: "Editar categoria",
                  delete: "Excluir categoria",
               }}
               onDelete={deleteCategory}
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
                  edit: "Editar categoria",
                  delete: "Excluir categoria",
               }}
               onDelete={deleteCategory}
               onEdit={handleEdit}
               variant="mobile"
            />
         }
         mobileContent={mobileContent}
      />
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
      <EntityMobileCard
         icon={
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
         }
         isExpanded={isExpanded}
         title={category.name}
         toggleExpanded={toggleExpanded}
      />
   );
}
