import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import { Plus } from "lucide-react";
import { DefaultHeader } from "@/default/default-header";
import { useSheet } from "@/hooks/use-sheet";
import { CategoryListProvider } from "../features/category-list-context";
import { ManageCategoryForm } from "../features/manage-category-form";
import { CategoriesListSection } from "./categories-list-section";
import { CategoriesStats } from "./categories-stats";

export type Category =
   RouterOutput["categories"]["getAllPaginated"]["categories"][0];

export function CategoriesPage() {
   const { openSheet } = useSheet();

   return (
      <CategoryListProvider>
         <main className="space-y-4">
            <DefaultHeader
               actions={
                  <Button
                     onClick={() =>
                        openSheet({
                           children: <ManageCategoryForm />,
                        })
                     }
                  >
                     <Plus className="size-4" />
                     Adicionar
                  </Button>
               }
               description="Visualize e gerencie suas categorias aqui."
               title="Suas categorias"
            />
            <CategoriesStats />
            <CategoriesListSection />
         </main>
      </CategoryListProvider>
   );
}
