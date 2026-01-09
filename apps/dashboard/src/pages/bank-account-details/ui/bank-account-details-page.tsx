import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   getDateRangeForPeriod,
   type TimePeriod,
   type TimePeriodDateRange,
} from "@packages/ui/components/time-period-chips";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import {
   Building,
   Download,
   Edit,
   Home,
   Plus,
   Shield,
   Trash2,
   Upload,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { ManageBankAccountForm } from "@/features/bank-account/ui/manage-bank-account-form";
import { BankAccountPermissionsSheet } from "@/features/permissions/ui/bank-account-permissions-sheet";
import { TransactionListProvider } from "@/features/transaction/lib/transaction-list-context";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { useDeleteBankAccount } from "../features/use-delete-bank-account";
import { BankAccountCharts } from "./bank-account-charts";
import { BankAccountFilterBar } from "./bank-account-filter-bar";
import { RecentTransactions } from "./bank-account-recent-transactions-section";
import { BankAccountStats } from "./bank-account-stats";

function BankAccountContent() {
   const params = useParams({ strict: false });
   const bankAccountId =
      (params as { bankAccountId?: string }).bankAccountId ?? "";
   const trpc = useTRPC();
   const { openSheet } = useSheet();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();

   const [timePeriod, setTimePeriod] = useState<TimePeriod | null>(
      "this-month",
   );
   const [customDateRange, setCustomDateRange] = useState<{
      startDate: Date | null;
      endDate: Date | null;
   }>({ startDate: null, endDate: null });
   const [typeFilter, setTypeFilter] = useState<string>("");
   const [categoryFilter, setCategoryFilter] = useState<string>("all");

   const effectiveDateRange = useMemo(() => {
      if (timePeriod === "custom") {
         return customDateRange;
      }
      if (timePeriod) {
         const range = getDateRangeForPeriod(timePeriod);
         return { endDate: range.endDate, startDate: range.startDate };
      }
      return { startDate: null, endDate: null };
   }, [timePeriod, customDateRange]);

   const handleTimePeriodChange = (
      period: TimePeriod | null,
      range: TimePeriodDateRange,
   ) => {
      setTimePeriod(period);
      if (period === "custom") {
         setCustomDateRange({
            endDate: range.endDate,
            startDate: range.startDate,
         });
      }
   };

   const handleClearFilters = () => {
      setTimePeriod("this-month");
      setCustomDateRange({ startDate: null, endDate: null });
      setTypeFilter("");
      setCategoryFilter("all");
   };

   const hasActiveFilters =
      (timePeriod !== "this-month" && timePeriod !== null) ||
      typeFilter !== "" ||
      categoryFilter !== "all";

   const chartGranularity =
      timePeriod === "all-time" || timePeriod === "this-year"
         ? ("monthly" as const)
         : ("daily" as const);

   const { data: bankAccount } = useSuspenseQuery(
      trpc.bankAccounts.getById.queryOptions({ id: bankAccountId }),
   );

   const { data: categories = [] } = useSuspenseQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/bank-accounts",
      });
   };

   const { canDelete, deleteBankAccount } = useDeleteBankAccount({
      bankAccount,
      onSuccess: handleDeleteSuccess,
   });
   if (!bankAccountId) {
      return (
         <BankAccountPageError
            error={new Error("Invalid bank account ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!bankAccount) {
      return null;
   }

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({ children: <ManageTransactionForm /> })
                  }
               >
                  <Plus className="size-4" />
                  Adicionar Nova Transação
               </Button>
            }
            description="Veja todas as suas transações financeiras aqui."
            title={bankAccount.name || "Conta Bancária"}
         />

         <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{ slug: activeOrganization.slug }}
                  search={{ bankAccountId }}
                  to="/$slug/import"
               >
                  <Upload className="size-4" />
                  Importar Extrato
               </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{ slug: activeOrganization.slug }}
                  search={{ bankAccountId }}
                  to="/$slug/export"
               >
                  <Download className="size-4" />
                  Exportar Extrato
               </Link>
            </Button>
            <Button
               onClick={() =>
                  openSheet({
                     children: (
                        <ManageBankAccountForm bankAccount={bankAccount} />
                     ),
                  })
               }
               size="sm"
               variant="outline"
            >
               <Edit className="size-4" />
               Editar Conta
            </Button>
            <Tooltip>
               <TooltipTrigger>
                  <Button
                     className="text-destructive hover:text-destructive"
                     disabled={!canDelete}
                     onClick={deleteBankAccount}
                     size="sm"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                     Excluir Conta
                  </Button>
               </TooltipTrigger>
               {!canDelete && (
                  <TooltipContent>
                     <p>
                        Você deve ter pelo menos uma conta bancária.
                     </p>
                  </TooltipContent>
               )}
            </Tooltip>
            <Button
               onClick={() =>
                  openSheet({
                     children: (
                        <BankAccountPermissionsSheet
                           bankAccountId={bankAccountId}
                           bankAccountName={
                              bankAccount.name || "Conta Bancária"
                           }
                        />
                     ),
                  })
               }
               size="sm"
               variant="outline"
            >
               <Shield className="size-4" />
               Gerenciar Acessos
            </Button>
         </div>

         <BankAccountFilterBar
            categories={categories}
            categoryFilter={categoryFilter}
            customDateRange={customDateRange}
            hasActiveFilters={hasActiveFilters}
            onCategoryFilterChange={setCategoryFilter}
            onClearFilters={handleClearFilters}
            onCustomDateRangeChange={setCustomDateRange}
            onTimePeriodChange={handleTimePeriodChange}
            onTypeFilterChange={setTypeFilter}
            timePeriod={timePeriod}
            typeFilter={typeFilter}
         />

         <BankAccountStats
            bankAccountId={bankAccountId}
            endDate={effectiveDateRange.endDate}
            startDate={effectiveDateRange.startDate}
         />
         <BankAccountCharts
            bankAccountId={bankAccountId}
            endDate={effectiveDateRange.endDate}
            granularity={chartGranularity}
            startDate={effectiveDateRange.startDate}
         />
         <RecentTransactions
            bankAccountId={bankAccountId}
            categoryFilter={categoryFilter}
            endDate={effectiveDateRange.endDate}
            startDate={effectiveDateRange.startDate}
            typeFilter={typeFilter}
         />
      </main>
   );
}

function BankAccountPageSkeleton() {
   return (
      <main className="space-y-4">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-72" />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
         </div>
         <Skeleton className="h-64 w-full" />
      </main>
   );
}

function BankAccountPageError({ error, resetErrorBoundary }: FallbackProps) {
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();
   return (
      <main className="flex flex-col h-full w-full">
         <div className="flex-1 flex items-center justify-center">
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <Building className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Failed to load bank account</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/bank-accounts",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <Home className="size-4 mr-2" />
                        Go to Bank Accounts
                     </Button>
                     <Button
                        onClick={resetErrorBoundary}
                        size="default"
                        variant="default"
                     >
                        Try Again
                     </Button>
                  </div>
               </EmptyContent>
            </Empty>
         </div>
      </main>
   );
}

export function BankAccountDetailsPage() {
   return (
      <TransactionListProvider>
         <ErrorBoundary FallbackComponent={BankAccountPageError}>
            <Suspense fallback={<BankAccountPageSkeleton />}>
               <BankAccountContent />
            </Suspense>
         </ErrorBoundary>
      </TransactionListProvider>
   );
}
