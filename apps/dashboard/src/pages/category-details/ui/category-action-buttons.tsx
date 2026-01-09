import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { Edit, Trash2 } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { ManageCategoryForm } from "../../categories/features/manage-category-form";
import { useDeleteCategory } from "../../categories/features/use-delete-category";

type Category = RouterOutput["categories"]["getById"];

function CategoryActionButtonsErrorFallback(props: FallbackProps) {
   return (
      <div className="flex gap-2">
         {createErrorFallback({
            errorDescription: "Failed to load action buttons",
            errorTitle: "Error",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function CategoryActionButtonsSkeleton() {
   return (
      <div className="flex flex-wrap items-center gap-2">
         <Skeleton className="h-8 w-32" />
         <Skeleton className="h-8 w-32" />
      </div>
   );
}

function CategoryActionButtonsContent() {
   const params = useParams({ strict: false });
   const categoryId = (params as { categoryId?: string }).categoryId ?? "";
   const trpc = useTRPC();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();

   const { data: category } = useSuspenseQuery(
      trpc.categories.getById.queryOptions({ id: categoryId }),
   );

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/categories",
      });
   };

   const { deleteCategory } = useDeleteCategory({
      category: category as Category,
      onSuccess: handleDeleteSuccess,
   });

   if (!category) {
      return null;
   }

   return (
      <div className="flex flex-wrap items-center gap-2">
         <Button
            onClick={() =>
               openSheet({
                  children: (
                     <ManageCategoryForm category={category as Category} />
                  ),
               })
            }
            size="sm"
            variant="outline"
         >
            <Edit className="size-4" />
            Editar categoria
         </Button>
         <Button
            className="text-destructive hover:text-destructive"
            onClick={deleteCategory}
            size="sm"
            variant="outline"
         >
            <Trash2 className="size-4" />
            Excluir categoria
         </Button>
      </div>
   );
}

export function CategoryActionButtons() {
   return (
      <ErrorBoundary FallbackComponent={CategoryActionButtonsErrorFallback}>
         <Suspense fallback={<CategoryActionButtonsSkeleton />}>
            <CategoryActionButtonsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
