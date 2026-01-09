import { formatDecimalCurrency } from "@packages/money";
import { Alert, AlertDescription } from "@packages/ui/components/alert";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Badge } from "@packages/ui/components/badge";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Landmark, Paperclip } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";

type CategorySplit = {
   categoryId: string;
   value: number;
   splitType: "amount";
};

function MetadataBadgesErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>
            Falha ao carregar categorias
         </AlertDescription>
      </Alert>
   );
}

function MetadataBadgesSkeleton() {
   return (
      <div className="flex flex-wrap items-center gap-2">
         <Skeleton className="h-7 w-32 rounded-full" />
         <Skeleton className="h-7 w-24 rounded-full" />
         <Skeleton className="h-7 w-28 rounded-full" />
      </div>
   );
}

function MetadataBadgesContent({ transactionId }: { transactionId: string }) {
   const trpc = useTRPC();
   const { activeOrganization } = useActiveOrganization();
   const slug = activeOrganization.slug;

   const { data: transaction } = useSuspenseQuery(
      trpc.transactions.getById.queryOptions({ id: transactionId }),
   );

   const { data: attachments = [] } = useQuery(
      trpc.transactions.getAttachments.queryOptions({
         transactionId: transactionId,
      }),
   );

   const categories = transaction.transactionCategories || [];
   const tags = transaction.transactionTags || [];
   const costCenter = transaction.costCenter;
   const bankAccount = transaction.bankAccount;
   const categorySplits = transaction.categorySplits as CategorySplit[] | null;
   const hasSplit = categorySplits && categorySplits.length > 0;

   const hasCategories = categories.length > 0;
   const hasTags = tags.length > 0;
   const hasCostCenter = !!costCenter;
   const hasBankAccount = !!bankAccount;
   const hasAttachments = attachments.length > 0;

   const hasAnyMetadata =
      hasSplit ||
      hasCategories ||
      hasTags ||
      hasCostCenter ||
      hasBankAccount ||
      hasAttachments;

   if (!hasAnyMetadata) {
      return null;
   }

   return (
      <div className="flex flex-wrap items-center gap-2">
         {hasSplit && (
            <>
               {categorySplits.map((split) => {
                  const categoryData = categories.find(
                     (tc) => tc.category.id === split.categoryId,
                  );
                  if (!categoryData) return null;
                  const cat = categoryData.category;
                  return (
                     <Announcement key={split.categoryId}>
                        <AnnouncementTag
                           className="flex items-center gap-1.5"
                           style={{
                              backgroundColor: `${cat.color}20`,
                              color: cat.color,
                           }}
                        >
                           <IconDisplay
                              iconName={(cat.icon || "Tag") as IconName}
                              size={14}
                           />
                           {cat.name}
                        </AnnouncementTag>
                        <AnnouncementTitle>
                           {formatDecimalCurrency(split.value / 100)}
                        </AnnouncementTitle>
                     </Announcement>
                  );
               })}
               {(hasTags ||
                  hasCostCenter ||
                  hasBankAccount ||
                  hasAttachments) && <div className="h-4 w-px bg-border" />}
            </>
         )}

         {hasTags && (
            <>
               {tags.map((transactionTag) => (
                  <Link
                     key={transactionTag.tag.id}
                     params={{ slug, tagId: transactionTag.tag.id }}
                     to="/$slug/tags/$tagId"
                  >
                     <Badge
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                           backgroundColor: transactionTag.tag.color,
                        }}
                        variant="secondary"
                     >
                        {transactionTag.tag.name}
                     </Badge>
                  </Link>
               ))}
               {(hasCostCenter || hasBankAccount || hasAttachments) && (
                  <div className="h-4 w-px bg-border" />
               )}
            </>
         )}

         {hasCostCenter && (
            <>
               <Announcement>
                  <AnnouncementTag>Centro de Custo</AnnouncementTag>
                  <AnnouncementTitle>{costCenter.name}</AnnouncementTitle>
               </Announcement>
               {(hasBankAccount || hasAttachments) && (
                  <div className="h-4 w-px bg-border" />
               )}
            </>
         )}

         {hasBankAccount && (
            <>
               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Landmark className="size-3.5" />
                     Conta
                  </AnnouncementTag>
                  <AnnouncementTitle>{bankAccount.name}</AnnouncementTitle>
               </Announcement>
               {hasAttachments && <div className="h-4 w-px bg-border" />}
            </>
         )}

         {hasAttachments && (
            <Announcement>
               <AnnouncementTag className="flex items-center gap-1.5">
                  <Paperclip className="size-3.5" />
                  Anexos
               </AnnouncementTag>
               <AnnouncementTitle>
                  {attachments.length}{" "}
                  {attachments.length === 1 ? "arquivo" : "arquivos"}
               </AnnouncementTitle>
            </Announcement>
         )}
      </div>
   );
}

export function TransactionMetadataBadges({
   transactionId,
}: {
   transactionId: string;
}) {
   return (
      <ErrorBoundary FallbackComponent={MetadataBadgesErrorFallback}>
         <Suspense fallback={<MetadataBadgesSkeleton />}>
            <MetadataBadgesContent transactionId={transactionId} />
         </Suspense>
      </ErrorBoundary>
   );
}
