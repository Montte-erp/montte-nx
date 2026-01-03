import type { RouterOutput } from "@packages/api/client";
import { translate } from "@packages/localization";
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
import { ManageTagForm } from "../../tags/features/manage-tag-form";
import { useDeleteTag } from "../../tags/features/use-delete-tag";

type Tag = RouterOutput["tags"]["getById"];

function TagActionButtonsErrorFallback(props: FallbackProps) {
   return (
      <div className="flex gap-2">
         {createErrorFallback({
            errorDescription: "Failed to load action buttons",
            errorTitle: "Error",
            retryText: translate("common.actions.retry"),
         })(props)}
      </div>
   );
}

function TagActionButtonsSkeleton() {
   return (
      <div className="flex flex-wrap items-center gap-2">
         <Skeleton className="h-8 w-32" />
         <Skeleton className="h-8 w-32" />
      </div>
   );
}

function TagActionButtonsContent() {
   const params = useParams({ strict: false });
   const tagId = (params as { tagId?: string }).tagId ?? "";
   const trpc = useTRPC();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();

   const { data: tag } = useSuspenseQuery(
      trpc.tags.getById.queryOptions({ id: tagId }),
   );

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/tags",
      });
   };

   const { deleteTag } = useDeleteTag({
      onSuccess: handleDeleteSuccess,
      tag: tag as Tag,
   });

   if (!tag) {
      return null;
   }

   return (
      <div className="flex flex-wrap items-center gap-2">
         <Button
            onClick={() =>
               openSheet({
                  children: <ManageTagForm tag={tag as Tag} />,
               })
            }
            size="sm"
            variant="outline"
         >
            <Edit className="size-4" />
            {translate(
               "dashboard.routes.tags.list-section.actions.edit-tag",
            )}
         </Button>
         <Button
            className="text-destructive hover:text-destructive"
            onClick={deleteTag}
            size="sm"
            variant="outline"
         >
            <Trash2 className="size-4" />
            {translate(
               "dashboard.routes.tags.list-section.actions.delete-tag",
            )}
         </Button>
      </div>
   );
}

export function TagActionButtons() {
   return (
      <ErrorBoundary FallbackComponent={TagActionButtonsErrorFallback}>
         <Suspense fallback={<TagActionButtonsSkeleton />}>
            <TagActionButtonsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
