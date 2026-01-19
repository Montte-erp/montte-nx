import { formatDecimalCurrency } from "@packages/money";
import { Alert, AlertDescription } from "@packages/ui/components/alert";
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
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQueries } from "@tanstack/react-query";
import { AlertCircle, Calendar, CheckCircle2, Clock } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useTRPC } from "@/integrations/clients";

function MetadataCardErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar metadados</AlertDescription>
      </Alert>
   );
}

function MetadataCardSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
         </CardHeader>
         <CardContent className="space-y-3">
            <Skeleton className="h-7 w-full rounded-full" />
            <Skeleton className="h-7 w-full rounded-full" />
            <Skeleton className="h-7 w-full rounded-full" />
            <Skeleton className="h-7 w-full rounded-full" />
         </CardContent>
      </Card>
   );
}

function MetadataCardContent({ billId }: { billId: string }) {
   const trpc = useTRPC();

   const [billQuery, categoriesQuery] = useSuspenseQueries({
      queries: [
         trpc.bills.getById.queryOptions({ id: billId }),
         trpc.categories.getAll.queryOptions(),
      ],
   });

   const bill = billQuery.data;
   const categories = categoriesQuery.data ?? [];
   const category = categories.find((c) => c.id === bill.categoryId);

   const amount = Number(bill.amount);
   const isIncome = bill.type === "income";
   const formattedAmount = formatDecimalCurrency(amount);

   // Calculate status
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   const isCompleted = !!bill.completionDate;
   const isOverdue =
      bill.dueDate && !bill.completionDate && new Date(bill.dueDate) < today;

   const getStatusConfig = () => {
      if (isCompleted) {
         return {
            color: "text-green-600",
            icon: CheckCircle2,
            label: "Paga",
         };
      }
      if (isOverdue) {
         return {
            color: "text-destructive",
            icon: AlertCircle,
            label: "Vencida",
         };
      }
      return {
         color: "text-amber-600",
         icon: Clock,
         label: "Pendente",
      };
   };

   const statusConfig = getStatusConfig();
   const StatusIcon = statusConfig.icon;

   return (
      <Card className="h-fit">
         <CardHeader>
            <CardTitle>Metadados</CardTitle>
            <CardDescription>Informações da conta</CardDescription>
         </CardHeader>
         <CardContent>
            <div className="flex flex-wrap gap-2">
               <Announcement>
                  <AnnouncementTag>Valor</AnnouncementTag>
                  <AnnouncementTitle
                     className={
                        isIncome ? "text-green-600" : "text-destructive"
                     }
                  >
                     {isIncome ? "+" : "-"}
                     {formattedAmount}
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag
                     className={`flex items-center gap-1.5 ${statusConfig.color}`}
                  >
                     <StatusIcon className="size-3.5" />
                     Status
                  </AnnouncementTag>
                  <AnnouncementTitle>{statusConfig.label}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Calendar className="size-3.5" />
                     Vencimento
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {formatDate(new Date(bill.dueDate), "DD/MM/YYYY")}
                  </AnnouncementTitle>
               </Announcement>

               {category && (
                  <Announcement>
                     <AnnouncementTag className="flex items-center gap-1.5">
                        <div
                           className="size-3.5 rounded flex items-center justify-center"
                           style={{ backgroundColor: category.color }}
                        >
                           <IconDisplay
                              iconName={(category.icon || "Wallet") as IconName}
                              size={8}
                           />
                        </div>
                        Categoria
                     </AnnouncementTag>
                     <AnnouncementTitle>{category.name}</AnnouncementTitle>
                  </Announcement>
               )}

               <Announcement>
                  <AnnouncementTag>Tipo</AnnouncementTag>
                  <AnnouncementTitle>
                     {bill.type === "expense" ? "A Pagar" : "A Receber"}
                  </AnnouncementTitle>
               </Announcement>
            </div>
         </CardContent>
      </Card>
   );
}

export function BillMetadataCard({ billId }: { billId: string }) {
   return (
      <ErrorBoundary FallbackComponent={MetadataCardErrorFallback}>
         <Suspense fallback={<MetadataCardSkeleton />}>
            <MetadataCardContent billId={billId} />
         </Suspense>
      </ErrorBoundary>
   );
}
