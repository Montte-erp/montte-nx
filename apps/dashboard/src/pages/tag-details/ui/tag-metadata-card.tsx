import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Calendar, Palette, Tag } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

function TagMetadataCardErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription: "Falha ao carregar metadados da tag",
               errorTitle: "Erro",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function TagMetadataCardSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40" />
         </CardHeader>
         <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
               <Skeleton className="h-8 w-32" />
               <Skeleton className="h-8 w-24" />
               <Skeleton className="h-8 w-28" />
            </div>
         </CardContent>
      </Card>
   );
}

function TagMetadataCardContent() {
   const params = useParams({ strict: false });
   const tagId = (params as { tagId?: string }).tagId ?? "";
   const trpc = useTRPC();

   const { data: tag } = useSuspenseQuery(
      trpc.tags.getById.queryOptions({ id: tagId }),
   );

   if (!tag) {
      return null;
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle className="text-base">Metadados</CardTitle>
            <CardDescription>Informações da categoria</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
               <Announcement>
                  <AnnouncementTag
                     className="flex items-center gap-1.5"
                     style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                     }}
                  >
                     <Tag className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle>{tag.name}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Palette className="size-3.5" />
                     Cor
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     <div
                        className="size-4 rounded-sm"
                        style={{ backgroundColor: tag.color }}
                     />
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Calendar className="size-3.5" />
                     Data de Criação
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {formatDate(new Date(tag.createdAt), "DD MMM YYYY")}
                  </AnnouncementTitle>
               </Announcement>
            </div>
         </CardContent>
      </Card>
   );
}

export function TagMetadataCard() {
   return (
      <ErrorBoundary FallbackComponent={TagMetadataCardErrorFallback}>
         <Suspense fallback={<TagMetadataCardSkeleton />}>
            <TagMetadataCardContent />
         </Suspense>
      </ErrorBoundary>
   );
}
