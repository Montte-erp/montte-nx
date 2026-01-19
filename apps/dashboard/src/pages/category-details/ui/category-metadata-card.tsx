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
import {
   ArrowDownLeft,
   ArrowLeftRight,
   ArrowUpRight,
   Calendar,
   Palette,
   Tag,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useTRPC } from "@/integrations/clients";

const TRANSACTION_TYPE_CONFIG = {
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

function CategoryMetadataCardErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription: "Failed to load category metadata",
               errorTitle: "Error",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function CategoryMetadataCardSkeleton() {
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
            <div className="flex flex-wrap gap-2">
               <Skeleton className="h-8 w-20" />
               <Skeleton className="h-8 w-20" />
               <Skeleton className="h-8 w-24" />
            </div>
         </CardContent>
      </Card>
   );
}

function CategoryMetadataCardContent() {
   const params = useParams({ strict: false });
   const categoryId = (params as { categoryId?: string }).categoryId ?? "";
   const trpc = useTRPC();

   const { data: category } = useSuspenseQuery(
      trpc.categories.getById.queryOptions({ id: categoryId }),
   );

   if (!category) {
      return null;
   }

   const types = category.transactionTypes || ["income", "expense", "transfer"];

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
                        backgroundColor: `${category.color}20`,
                        color: category.color,
                     }}
                  >
                     <IconDisplay
                        iconName={(category.icon || "Wallet") as IconName}
                        size={14}
                     />
                  </AnnouncementTag>
                  <AnnouncementTitle>{category.name}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Palette className="size-3.5" />
                     Cor
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     <div
                        className="size-4 rounded-sm"
                        style={{ backgroundColor: category.color }}
                     />
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Tag className="size-3.5" />
                     Ícone
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {category.icon || "Wallet"}
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Calendar className="size-3.5" />
                     Data de Criação
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {formatDate(new Date(category.createdAt), "DD MMM YYYY")}
                  </AnnouncementTitle>
               </Announcement>
            </div>

            <div className="pt-2 border-t">
               <p className="text-sm text-muted-foreground mb-2">Tipo</p>
               <div className="flex flex-wrap gap-2">
                  {types.map((type) => {
                     const config =
                        TRANSACTION_TYPE_CONFIG[
                           type as keyof typeof TRANSACTION_TYPE_CONFIG
                        ];
                     if (!config) return null;
                     const Icon = config.icon;
                     return (
                        <Announcement key={type}>
                           <AnnouncementTag
                              className="flex items-center gap-1"
                              style={{
                                 backgroundColor: `${config.color}20`,
                                 color: config.color,
                              }}
                           >
                              <Icon className="size-3" />
                           </AnnouncementTag>
                           <AnnouncementTitle style={{ color: config.color }}>
                              {config.label}
                           </AnnouncementTitle>
                        </Announcement>
                     );
                  })}
               </div>
            </div>
         </CardContent>
      </Card>
   );
}

export function CategoryMetadataCard() {
   return (
      <ErrorBoundary FallbackComponent={CategoryMetadataCardErrorFallback}>
         <Suspense fallback={<CategoryMetadataCardSkeleton />}>
            <CategoryMetadataCardContent />
         </Suspense>
      </ErrorBoundary>
   );
}
