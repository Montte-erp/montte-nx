import { translate } from "@packages/localization";
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
import { useSuspenseQuery } from "@tanstack/react-query";
import {
   Calendar,
   CheckCircle,
   CircleDashed,
   Clock,
   RefreshCw,
   Target,
   Wallet,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
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

function MetadataCardContent({ budgetId }: { budgetId: string }) {
   const trpc = useTRPC();

   const { data: budget } = useSuspenseQuery(
      trpc.budgets.getById.queryOptions({ id: budgetId }),
   );

   const amount = parseFloat(budget.amount);
   const formattedAmount = formatDecimalCurrency(amount);
   const createdAt = formatDate(new Date(budget.createdAt), "DD/MM/YYYY");

   const periodLabels: Record<string, string> = {
      custom: translate("dashboard.routes.budgets.form.period.custom"),
      daily: translate("dashboard.routes.budgets.form.period.daily"),
      monthly: translate("dashboard.routes.budgets.form.period.monthly"),
      quarterly: translate("dashboard.routes.budgets.form.period.quarterly"),
      weekly: translate("dashboard.routes.budgets.form.period.weekly"),
      yearly: translate("dashboard.routes.budgets.form.period.yearly"),
   };

   const regimeLabels: Record<string, string> = {
      accrual: translate("dashboard.routes.budgets.form.regime.accrual"),
      cash: translate("dashboard.routes.budgets.form.regime.cash"),
   };

   const targetTypeLabels: Record<string, string> = {
      categories: translate("dashboard.routes.budgets.form.target.categories"),
      category: translate("dashboard.routes.budgets.form.target.category"),
      cost_center: translate(
         "dashboard.routes.budgets.form.target.cost_center",
      ),
      tag: translate("dashboard.routes.budgets.form.target.tag"),
   };

   const periodLabel = periodLabels[budget.periodType] ?? budget.periodType;
   const regimeLabel = regimeLabels[budget.regime] ?? budget.regime;
   const targetLabel = budget.target?.type
      ? targetTypeLabels[budget.target.type]
      : "-";

   const StatusIcon = budget.isActive ? CheckCircle : CircleDashed;
   const statusColor = budget.isActive ? "#10b981" : "#6b7280";
   const statusLabel = budget.isActive
      ? translate("dashboard.routes.budgets.status.active")
      : translate("dashboard.routes.budgets.status.inactive");

   const rolloverColor = budget.rollover ? "#3b82f6" : "#6b7280";
   const rolloverLabel = budget.rollover
      ? translate(
           "dashboard.routes.budgets.details.information.rollover-enabled",
        )
      : translate(
           "dashboard.routes.budgets.details.information.rollover-disabled",
        );

   return (
      <Card className="h-fit">
         <CardHeader>
            <CardTitle>Metadados</CardTitle>
            <CardDescription>Informações do orçamento</CardDescription>
         </CardHeader>
         <CardContent>
            <div className="flex flex-wrap gap-2">
               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Wallet className="size-3.5" />
                     Valor
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-primary">
                     {formattedAmount}
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag
                     className="flex items-center gap-1.5"
                     style={{ color: statusColor }}
                  >
                     <StatusIcon className="size-3.5" />
                     Status
                  </AnnouncementTag>
                  <AnnouncementTitle>{statusLabel}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Calendar className="size-3.5" />
                     Período
                  </AnnouncementTag>
                  <AnnouncementTitle>{periodLabel}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag
                     className="flex items-center gap-1.5"
                     style={{ color: rolloverColor }}
                  >
                     <RefreshCw className="size-3.5" />
                     Rollover
                  </AnnouncementTag>
                  <AnnouncementTitle>{rolloverLabel}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Target className="size-3.5" />
                     Alvo
                  </AnnouncementTag>
                  <AnnouncementTitle>{targetLabel}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag>Regime</AnnouncementTag>
                  <AnnouncementTitle>{regimeLabel}</AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Clock className="size-3.5" />
                     Criado em
                  </AnnouncementTag>
                  <AnnouncementTitle>{createdAt}</AnnouncementTitle>
               </Announcement>
            </div>
         </CardContent>
      </Card>
   );
}

export function BudgetMetadataCard({ budgetId }: { budgetId: string }) {
   return (
      <ErrorBoundary FallbackComponent={MetadataCardErrorFallback}>
         <Suspense fallback={<MetadataCardSkeleton />}>
            <MetadataCardContent budgetId={budgetId} />
         </Suspense>
      </ErrorBoundary>
   );
}
