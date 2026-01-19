import { Alert, AlertDescription } from "@packages/ui/components/alert";
import { Badge } from "@packages/ui/components/badge";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Separator } from "@packages/ui/components/separator";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import {
   getRecurrenceLabel,
   type RecurrencePattern,
} from "@packages/utils/recurrence";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
   Building,
   CalendarDays,
   CheckCircle2,
   FileText,
   Layers,
   Tags,
   User,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

function InfoCardErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar informações</AlertDescription>
      </Alert>
   );
}

function InfoCardSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-6 w-32" />
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {Array.from({ length: 4 }).map((_, i) => (
                  <div
                     className="flex items-center gap-3"
                     key={`info-skeleton-${i + 1}`}
                  >
                     <Skeleton className="size-4" />
                     <div className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-28" />
                     </div>
                  </div>
               ))}
            </div>
         </CardContent>
      </Card>
   );
}

function InfoCardContent({ billId }: { billId: string }) {
   const trpc = useTRPC();

   const { data: bill } = useSuspenseQuery(
      trpc.bills.getById.queryOptions({ id: billId }),
   );

   const { data: billTags = [] } = useSuspenseQuery(
      trpc.bills.getBillTags.queryOptions({ billId }),
   );

   const hasInfo =
      bill.issueDate ||
      bill.completionDate ||
      (bill.isRecurring && bill.recurrencePattern) ||
      bill.bankAccount ||
      bill.costCenter ||
      bill.counterparty ||
      billTags.length > 0 ||
      bill.notes;

   if (!hasInfo) {
      return null;
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle>Informações Adicionais</CardTitle>
         </CardHeader>
         <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {bill.issueDate && (
                  <div className="flex items-center gap-3">
                     <FileText className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Data de Emissão
                        </p>
                        <p className="text-sm font-medium">
                           {formatDate(new Date(bill.issueDate), "DD/MM/YYYY")}
                        </p>
                     </div>
                  </div>
               )}

               {bill.completionDate && (
                  <div className="flex items-center gap-3">
                     <CheckCircle2 className="size-4 text-green-500" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Concluído em
                        </p>
                        <p className="text-sm font-medium">
                           {formatDate(
                              new Date(bill.completionDate),
                              "DD/MM/YYYY",
                           )}
                        </p>
                     </div>
                  </div>
               )}

               {bill.isRecurring && bill.recurrencePattern && (
                  <div className="flex items-center gap-3">
                     <CalendarDays className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Recorrência
                        </p>
                        <p className="text-sm font-medium">
                           {getRecurrenceLabel(
                              bill.recurrencePattern as RecurrencePattern,
                           )}
                        </p>
                     </div>
                  </div>
               )}

               {bill.bankAccount && (
                  <div className="flex items-center gap-3">
                     <Building className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Conta Bancária (Opcional)
                        </p>
                        <p className="text-sm font-medium">
                           {bill.bankAccount.name}
                        </p>
                     </div>
                  </div>
               )}

               {bill.counterparty && (
                  <div className="flex items-center gap-3">
                     <User className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Fornecedor/Cliente
                        </p>
                        <p className="text-sm font-medium">
                           {bill.counterparty?.name}
                        </p>
                     </div>
                  </div>
               )}

               {bill.costCenter && (
                  <div className="flex items-center gap-3">
                     <Layers className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Centro de Custo
                        </p>
                        <p className="text-sm font-medium">
                           {bill.costCenter.code
                              ? `${bill.costCenter.code} - ${bill.costCenter.name}`
                              : bill.costCenter.name}
                        </p>
                     </div>
                  </div>
               )}

               {billTags.length > 0 && (
                  <div className="flex items-center gap-3">
                     <Tags className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">Tags</p>
                        <div className="flex gap-1 flex-wrap mt-0.5">
                           {billTags.map((tag) => (
                              <Badge
                                 key={tag.id}
                                 style={{ backgroundColor: tag.color }}
                                 variant="secondary"
                              >
                                 {tag.name}
                              </Badge>
                           ))}
                        </div>
                     </div>
                  </div>
               )}
            </div>

            {bill.notes && (
               <>
                  <Separator />
                  <div>
                     <p className="text-xs text-muted-foreground mb-1">
                        Observações
                     </p>
                     <p className="text-sm">{bill.notes}</p>
                  </div>
               </>
            )}
         </CardContent>
      </Card>
   );
}

export function BillInfoCard({ billId }: { billId: string }) {
   return (
      <ErrorBoundary FallbackComponent={InfoCardErrorFallback}>
         <Suspense fallback={<InfoCardSkeleton />}>
            <InfoCardContent billId={billId} />
         </Suspense>
      </ErrorBoundary>
   );
}
