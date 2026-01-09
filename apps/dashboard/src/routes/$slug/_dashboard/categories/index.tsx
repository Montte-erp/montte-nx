import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/pages/categories/ui/categories-page";

export const Route = createFileRoute("/$slug/_dashboard/categories/")({
   component: CategoriesPage,
   staticData: {
      breadcrumb: "Categorias",
   },
});
