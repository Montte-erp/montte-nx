import type {
   BudgetVsActualSnapshotData,
   CashFlowForecastSnapshotData,
   CounterpartyAnalysisSnapshotData,
   DRESnapshotData,
   ReportSnapshotData,
   ReportType,
   SpendingTrendsSnapshotData,
   TransactionSnapshot,
} from "@packages/database/schemas/custom-reports";
import { formatDecimalCurrency } from "@packages/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   type ChartConfig,
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
} from "@packages/ui/components/chart";
import { DataTable } from "@packages/ui/components/data-table";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { StatsCard } from "@packages/ui/components/stats-card";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
   Building2,
   Download,
   Edit,
   Filter,
   FolderTree,
   Tag,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import {
   Bar,
   BarChart,
   CartesianGrid,
   Cell,
   Legend,
   Line,
   LineChart,
   Pie,
   PieChart,
   XAxis,
   YAxis,
} from "recharts";
import { DefaultHeader } from "@/default/default-header";
import { ManageCustomReportForm } from "@/features/custom-report/ui/manage-custom-report-form";
import { TransactionExpandedContent } from "@/features/transaction/ui/transaction-expanded-content";
import type {
   Category,
   Transaction,
} from "@/features/transaction/ui/transaction-list";
import { TransactionMobileCard } from "@/features/transaction/ui/transaction-mobile-card";
import { createTransactionColumns } from "@/features/transaction/ui/transaction-table-columns";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { useExportPdf } from "@/pages/custom-reports/features/use-export-pdf";

const routeApi = getRouteApi("/$slug/_dashboard/custom-reports/$reportId");

// ============================================
// Type Guards
// ============================================

function isDREReport(type: ReportType): type is "dre_gerencial" | "dre_fiscal" {
   return type === "dre_gerencial" || type === "dre_fiscal";
}

function isDRESnapshotData(
   _data: ReportSnapshotData,
   type: ReportType,
): _data is DRESnapshotData {
   return isDREReport(type);
}

function isBudgetVsActualSnapshotData(
   _data: ReportSnapshotData,
   type: ReportType,
): _data is BudgetVsActualSnapshotData {
   return type === "budget_vs_actual";
}

function isSpendingTrendsSnapshotData(
   _data: ReportSnapshotData,
   type: ReportType,
): _data is SpendingTrendsSnapshotData {
   return type === "spending_trends";
}

function isCashFlowForecastSnapshotData(
   _data: ReportSnapshotData,
   type: ReportType,
): _data is CashFlowForecastSnapshotData {
   return type === "cash_flow_forecast";
}

function isCounterpartyAnalysisSnapshotData(
   _data: ReportSnapshotData,
   type: ReportType,
): _data is CounterpartyAnalysisSnapshotData {
   return type === "counterparty_analysis";
}

// ============================================
// Type-Specific Stats Card Components
// ============================================

function DREStatsCards({
   snapshotData,
   periodLabel,
}: {
   snapshotData: DRESnapshotData;
   periodLabel: string;
}) {
   return (
      <div className="grid gap-4 md:grid-cols-4">
         <StatsCard
            description={`Gerado em ${formatDate(new Date(snapshotData.generatedAt), "DD/MM/YYYY")}`}
            title="Período"
            value={periodLabel}
         />
         <StatsCard
            description={`${snapshotData.transactions?.length || 0} transações`}
            title="Total Receitas"
            value={`+${formatDecimalCurrency(snapshotData.summary.totalIncome)}`}
         />
         <StatsCard
            description="Despesas do período"
            title="Total Despesas"
            value={`-${formatDecimalCurrency(snapshotData.summary.totalExpenses)}`}
         />
         <StatsCard
            description={
               snapshotData.summary.netResult >= 0 ? "Lucro" : "Prejuízo"
            }
            title="Resultado Líquido"
            value={`${snapshotData.summary.netResult >= 0 ? "+" : ""}${formatDecimalCurrency(snapshotData.summary.netResult)}`}
         />
      </div>
   );
}

function BudgetVsActualStatsCards({
   snapshotData,
   periodLabel,
}: {
   snapshotData: BudgetVsActualSnapshotData;
   periodLabel: string;
}) {
   const varianceIsPositive = snapshotData.summary.variance >= 0;
   return (
      <div className="grid gap-4 md:grid-cols-4">
         <StatsCard
            description={`Gerado em ${formatDate(new Date(snapshotData.generatedAt), "DD/MM/YYYY")}`}
            title="Período"
            value={periodLabel}
         />
         <StatsCard
            description="Valor planejado para o período"
            title="Total Orçado"
            value={formatDecimalCurrency(snapshotData.summary.totalBudgeted)}
         />
         <StatsCard
            description="Valor realizado no período"
            title="Total Realizado"
            value={formatDecimalCurrency(snapshotData.summary.totalActual)}
         />
         <StatsCard
            description={`${Math.abs(snapshotData.summary.variancePercent).toFixed(1)}% ${varianceIsPositive ? "abaixo" : "acima"} do orçado`}
            title="Variação"
            value={`${varianceIsPositive ? "+" : ""}${formatDecimalCurrency(snapshotData.summary.variance)}`}
         />
      </div>
   );
}

function SpendingTrendsStatsCards({
   snapshotData,
   periodLabel,
}: {
   snapshotData: SpendingTrendsSnapshotData;
   periodLabel: string;
}) {
   const trendLabel =
      snapshotData.summary.trend === "increasing"
         ? "Aumentando"
         : snapshotData.summary.trend === "decreasing"
           ? "Diminuindo"
           : "Estável";

   return (
      <div className="grid gap-4 md:grid-cols-4">
         <StatsCard
            description={`Gerado em ${formatDate(new Date(snapshotData.generatedAt), "DD/MM/YYYY")}`}
            title="Período"
            value={periodLabel}
         />
         <StatsCard
            description="Média de receitas mensais"
            title="Receita Média"
            value={`+${formatDecimalCurrency(snapshotData.summary.avgMonthlyIncome)}`}
         />
         <StatsCard
            description="Média de despesas mensais"
            title="Despesa Média"
            value={`-${formatDecimalCurrency(snapshotData.summary.avgMonthlySpending)}`}
         />
         <StatsCard
            description={`${Math.abs(snapshotData.summary.trendPercent).toFixed(1)}% ${trendLabel.toLowerCase()}`}
            title="Tendência"
            value={trendLabel}
         />
      </div>
   );
}

function CashFlowForecastStatsCards({
   snapshotData,
   periodLabel,
}: {
   snapshotData: CashFlowForecastSnapshotData;
   periodLabel: string;
}) {
   const balanceChange =
      snapshotData.summary.projectedBalance - snapshotData.summary.currentBalance;

   return (
      <div className="grid gap-4 md:grid-cols-4">
         <StatsCard
            description={`Próximos ${snapshotData.summary.projectionDays} dias`}
            title="Período de Projeção"
            value={periodLabel}
         />
         <StatsCard
            description="Saldo atual das contas"
            title="Saldo Atual"
            value={formatDecimalCurrency(snapshotData.summary.currentBalance)}
         />
         <StatsCard
            description="Saldo projetado ao final"
            title="Saldo Projetado"
            value={formatDecimalCurrency(snapshotData.summary.projectedBalance)}
         />
         <StatsCard
            description={balanceChange >= 0 ? "Entrada líquida" : "Saída líquida"}
            title="Variação Projetada"
            value={`${balanceChange >= 0 ? "+" : ""}${formatDecimalCurrency(balanceChange)}`}
         />
      </div>
   );
}

function CounterpartyAnalysisStatsCards({
   snapshotData,
   periodLabel,
}: {
   snapshotData: CounterpartyAnalysisSnapshotData;
   periodLabel: string;
}) {
   return (
      <div className="grid gap-4 md:grid-cols-4">
         <StatsCard
            description={`Gerado em ${formatDate(new Date(snapshotData.generatedAt), "DD/MM/YYYY")}`}
            title="Período"
            value={periodLabel}
         />
         <StatsCard
            description={`${snapshotData.summary.totalCustomers} clientes, ${snapshotData.summary.totalSuppliers} fornecedores`}
            title="Contrapartes"
            value={snapshotData.summary.totalCounterparties.toString()}
         />
         <StatsCard
            description="Total recebido de clientes"
            title="Total Recebido"
            value={`+${formatDecimalCurrency(snapshotData.summary.totalReceived)}`}
         />
         <StatsCard
            description="Total pago a fornecedores"
            title="Total Pago"
            value={`-${formatDecimalCurrency(snapshotData.summary.totalPaid)}`}
         />
      </div>
   );
}

/**
 * Maps TransactionSnapshot to the structure expected by table components.
 * TransactionSnapshot has all display-relevant fields. This function fills
 * in additional metadata fields required by the Transaction type with
 * placeholder values since they're not used by the display components.
 */
function mapSnapshotToTableTransaction(
   snapshot: TransactionSnapshot,
): Transaction {
   const snapshotDate = new Date(snapshot.date);

   return {
      amount: snapshot.amount,
      attachmentKey: null,
      externalId: null,
      bankAccount: snapshot.bankAccount
         ? {
              ...snapshot.bankAccount,
              createdAt: snapshotDate,
              organizationId: "",
              status: "active" as const,
              type: "checking" as const,
              updatedAt: snapshotDate,
           }
         : null,
      bankAccountId: snapshot.bankAccount?.id ?? null,
      categorySplits: snapshot.categorySplits,
      costCenter: snapshot.costCenter
         ? {
              ...snapshot.costCenter,
              createdAt: snapshotDate,
              organizationId: "",
              updatedAt: snapshotDate,
           }
         : null,
      costCenterId: snapshot.costCenter?.id ?? null,
      createdAt: snapshotDate,
      date: snapshotDate,
      description: snapshot.description,
      id: snapshot.id,
      organizationId: "",
      transactionCategories: snapshot.transactionCategories.map((tc) => ({
         category: {
            ...tc.category,
            createdAt: snapshotDate,
            organizationId: "",
            transactionTypes: [],
            updatedAt: snapshotDate,
         },
         categoryId: tc.category.id,
         transactionId: snapshot.id,
      })),
      transactionTags: snapshot.transactionTags.map((tt) => ({
         tag: {
            ...tt.tag,
            createdAt: snapshotDate,
            organizationId: "",
            updatedAt: snapshotDate,
         },
         tagId: tt.tag.id,
         transactionId: snapshot.id,
      })),
      type: snapshot.type,
      updatedAt: snapshotDate,
      searchIndex: "",
   };
}

function CustomReportDetailsErrorFallback(props: FallbackProps) {
   return (
      <div className="space-y-4">
         {createErrorFallback({
            errorDescription:
               "Falha ao carregar relatório. Tente novamente mais tarde.",
            errorTitle: "Erro ao carregar relatório",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function CustomReportDetailsSkeleton() {
   return (
      <div className="space-y-6">
         <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
               <Skeleton className="h-6 w-48" />
               <Skeleton className="h-4 w-32" />
            </div>
         </div>
         <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
               <Card key={`stat-skeleton-${i + 1}`}>
                  <CardContent className="pt-6">
                     <Skeleton className="h-16 w-full" />
                  </CardContent>
               </Card>
            ))}
         </div>
         <Card>
            <CardHeader>
               <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
               <Skeleton className="h-64 w-full" />
            </CardContent>
         </Card>
      </div>
   );
}

function DRETable({
   snapshotData,
   type,
}: {
   snapshotData: DRESnapshotData;
   type: string;
}) {
   const isFiscal = type === "dre_fiscal";

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead className="w-16">Código</TableHead>
               <TableHead>Descrição</TableHead>
               {isFiscal ? (
                  <>
                     <TableHead className="text-right">Planejado</TableHead>
                     <TableHead className="text-right">Realizado</TableHead>
                     <TableHead className="text-right">Variação</TableHead>
                  </>
               ) : (
                  <TableHead className="text-right">Valor</TableHead>
               )}
            </TableRow>
         </TableHeader>
         <TableBody>
            {snapshotData.dreLines.map((line) => (
               <TableRow
                  className={line.isTotal ? "bg-muted/50 font-medium" : ""}
                  key={line.code}
               >
                  <TableCell className="text-muted-foreground">
                     {line.code}
                  </TableCell>
                  <TableCell
                     style={{ paddingLeft: `${line.indent * 24 + 16}px` }}
                  >
                     {line.label}
                  </TableCell>
                  {isFiscal ? (
                     <>
                        <TableCell className="text-right">
                           {formatDecimalCurrency(line.plannedValue || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                           {formatDecimalCurrency(line.value)}
                        </TableCell>
                        <TableCell
                           className={`text-right ${
                              (line.variance || 0) >= 0
                                 ? "text-emerald-600"
                                 : "text-destructive"
                           }`}
                        >
                           {(line.variance || 0) >= 0 ? "+" : ""}
                           {formatDecimalCurrency(line.variance || 0)}
                        </TableCell>
                     </>
                  ) : (
                     <TableCell
                        className={`text-right ${
                           line.value >= 0
                              ? "text-emerald-600"
                              : "text-destructive"
                        }`}
                     >
                        {formatDecimalCurrency(line.value)}
                     </TableCell>
                  )}
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

function FilterMetadataSection({
   snapshotData,
}: {
   snapshotData: DRESnapshotData;
}) {
   const filterMetadata = snapshotData.filterMetadata;
   if (!filterMetadata) {
      return null;
   }

   const hasFilters =
      (filterMetadata.bankAccounts && filterMetadata.bankAccounts.length > 0) ||
      (filterMetadata.categories && filterMetadata.categories.length > 0) ||
      (filterMetadata.costCenters && filterMetadata.costCenters.length > 0) ||
      (filterMetadata.tags && filterMetadata.tags.length > 0);

   if (!hasFilters) {
      return null;
   }

   return (
      <Card>
         <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
               <Filter className="size-4 text-muted-foreground" />
               <CardTitle className="text-base">Filtros Aplicados</CardTitle>
            </div>
         </CardHeader>
         <CardContent>
            <div className="flex flex-wrap gap-4">
               {filterMetadata.bankAccounts &&
                  filterMetadata.bankAccounts.length > 0 && (
                     <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                           <Building2 className="size-3" />
                           <span>Contas Bancárias</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                           {filterMetadata.bankAccounts.map((item) => (
                              <Badge key={item.id} variant="secondary">
                                 {item.name}
                              </Badge>
                           ))}
                        </div>
                     </div>
                  )}
               {filterMetadata.categories &&
                  filterMetadata.categories.length > 0 && (
                     <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                           <FolderTree className="size-3" />
                           <span>Categorias</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                           {filterMetadata.categories.map((item) => (
                              <Badge key={item.id} variant="secondary">
                                 {item.name}
                              </Badge>
                           ))}
                        </div>
                     </div>
                  )}
               {filterMetadata.costCenters &&
                  filterMetadata.costCenters.length > 0 && (
                     <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                           <Building2 className="size-3" />
                           <span>Centros de Custo</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                           {filterMetadata.costCenters.map((item) => (
                              <Badge key={item.id} variant="secondary">
                                 {item.name}
                              </Badge>
                           ))}
                        </div>
                     </div>
                  )}
               {filterMetadata.tags && filterMetadata.tags.length > 0 && (
                  <div className="space-y-1">
                     <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Tag className="size-3" />
                        <span>Tags</span>
                     </div>
                     <div className="flex flex-wrap gap-1">
                        {filterMetadata.tags.map((item) => (
                           <Badge key={item.id} variant="secondary">
                              {item.name}
                           </Badge>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         </CardContent>
      </Card>
   );
}

function CategoryBreakdownSection({
   snapshotData,
}: {
   snapshotData: DRESnapshotData;
}) {
   if (!snapshotData.categoryBreakdown?.length) {
      return null;
   }

   const expenseChartData = snapshotData.categoryBreakdown
      .filter((cat) => cat.expenses > 0)
      .map((cat) => ({
         category: cat.categoryName,
         color: cat.categoryColor,
         value: cat.expenses,
      }));

   const incomeChartData = snapshotData.categoryBreakdown
      .filter((cat) => cat.income > 0)
      .map((cat) => ({
         category: cat.categoryName,
         color: cat.categoryColor,
         value: cat.income,
      }));

   const expenseChartConfig = expenseChartData.reduce((acc, item) => {
      acc[item.category] = { color: item.color, label: item.category };
      return acc;
   }, {} as ChartConfig);

   const incomeChartConfig = incomeChartData.reduce((acc, item) => {
      acc[item.category] = { color: item.color, label: item.category };
      return acc;
   }, {} as ChartConfig);

   return (
      <div className="grid gap-4 md:grid-cols-2">
         {incomeChartData.length > 0 && (
            <Card>
               <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                     Receitas por Categoria
                  </CardTitle>
                  <CardDescription>
                     Distribuição das receitas do período
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <ChartContainer
                     className="mx-auto aspect-square max-h-[250px]"
                     config={incomeChartConfig}
                  >
                     <PieChart>
                        <ChartTooltip
                           content={
                              <ChartTooltipContent
                                 formatter={(value) =>
                                    formatDecimalCurrency(Number(value))
                                 }
                                 hideLabel
                              />
                           }
                        />
                        <Pie
                           data={incomeChartData}
                           dataKey="value"
                           innerRadius={50}
                           nameKey="category"
                           strokeWidth={2}
                        >
                           {incomeChartData.map((entry) => (
                              <Cell fill={entry.color} key={entry.category} />
                           ))}
                        </Pie>
                     </PieChart>
                  </ChartContainer>
                  <div className="mt-4 space-y-2">
                     {incomeChartData.map((cat) => (
                        <div
                           className="flex items-center justify-between text-sm"
                           key={cat.category}
                        >
                           <div className="flex items-center gap-2">
                              <div
                                 className="size-3 rounded-full"
                                 style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate max-w-[150px]">
                                 {cat.category}
                              </span>
                           </div>
                           <span className="font-medium text-emerald-600">
                              +{formatDecimalCurrency(cat.value)}
                           </span>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         )}

         {expenseChartData.length > 0 && (
            <Card>
               <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                     Despesas por Categoria
                  </CardTitle>
                  <CardDescription>
                     Distribuição das despesas do período
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <ChartContainer
                     className="mx-auto aspect-square max-h-[250px]"
                     config={expenseChartConfig}
                  >
                     <PieChart>
                        <ChartTooltip
                           content={
                              <ChartTooltipContent
                                 formatter={(value) =>
                                    formatDecimalCurrency(Number(value))
                                 }
                                 hideLabel
                              />
                           }
                        />
                        <Pie
                           data={expenseChartData}
                           dataKey="value"
                           innerRadius={50}
                           nameKey="category"
                           strokeWidth={2}
                        >
                           {expenseChartData.map((entry) => (
                              <Cell fill={entry.color} key={entry.category} />
                           ))}
                        </Pie>
                     </PieChart>
                  </ChartContainer>
                  <div className="mt-4 space-y-2">
                     {expenseChartData.map((cat) => (
                        <div
                           className="flex items-center justify-between text-sm"
                           key={cat.category}
                        >
                           <div className="flex items-center gap-2">
                              <div
                                 className="size-3 rounded-full"
                                 style={{ backgroundColor: cat.color }}
                              />
                              <span className="truncate max-w-[150px]">
                                 {cat.category}
                              </span>
                           </div>
                           <span className="font-medium text-destructive">
                              -{formatDecimalCurrency(cat.value)}
                           </span>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         )}
      </div>
   );
}

function TransactionsSection({
   snapshotData,
   slug,
}: {
   snapshotData: DRESnapshotData;
   slug: string;
}) {
   const [currentPage, setCurrentPage] = useState(1);
   const [pageSize, setPageSize] = useState(20);

   const transactions = snapshotData.transactions || [];

   const categories = useMemo(() => {
      const categoryMap = new Map<string, Category>();
      for (const tx of transactions) {
         for (const tc of tx.transactionCategories) {
            if (!categoryMap.has(tc.category.id)) {
               categoryMap.set(tc.category.id, tc.category);
            }
         }
      }
      return Array.from(categoryMap.values());
   }, [transactions]);

   const paginatedData = useMemo(() => {
      const startIndex = (currentPage - 1) * pageSize;
      return transactions
         .slice(startIndex, startIndex + pageSize)
         .map(mapSnapshotToTableTransaction);
   }, [transactions, currentPage, pageSize]);

   const columns = useMemo(
      () => createTransactionColumns(categories, slug),
      [categories, slug],
   );

   const totalPages = Math.ceil(transactions.length / pageSize);

   if (!transactions.length) {
      return null;
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle>Transações do Período</CardTitle>
            <CardDescription>
               {transactions.length} transações incluídas neste relatório
            </CardDescription>
         </CardHeader>
         <CardContent>
            <DataTable
               columns={columns}
               data={paginatedData}
               getRowId={(row) => row.id}
               pagination={{
                  currentPage,
                  onPageChange: setCurrentPage,
                  onPageSizeChange: setPageSize,
                  pageSize,
                  totalCount: transactions.length,
                  totalPages,
               }}
               renderMobileCard={(props) => (
                  <TransactionMobileCard {...props} categories={categories} />
               )}
               renderSubComponent={(props) => (
                  <TransactionExpandedContent
                     {...props}
                     categories={categories}
                     slug={slug}
                  />
               )}
            />
         </CardContent>
      </Card>
   );
}

// ============================================
// Type-Specific Content Sections
// ============================================

function BudgetVsActualContent({
   snapshotData,
}: {
   snapshotData: BudgetVsActualSnapshotData;
}) {
   const chartConfig: ChartConfig = {
      actual: { color: "hsl(var(--chart-2))", label: "Realizado" },
      budgeted: { color: "hsl(var(--chart-1))", label: "Orçado" },
   };

   const monthlyData = snapshotData.monthlyBreakdown.map((item) => ({
      actual: item.actual,
      budgeted: item.budgeted,
      month: `${item.month}/${item.year}`,
      variance: item.variance,
   }));

   const hasNoData =
      snapshotData.monthlyBreakdown.length === 0 &&
      snapshotData.categoryComparisons.length === 0;

   if (hasNoData) {
      return (
         <Card>
            <CardHeader>
               <CardTitle>Orçado vs Realizado</CardTitle>
               <CardDescription>
                  Não foram encontrados dados de orçamento no período selecionado
               </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground">
                  Para visualizar esta análise, certifique-se de que existem
                  orçamentos configurados para o período do relatório.
               </p>
            </CardContent>
         </Card>
      );
   }

   return (
      <>
         <Card>
            <CardHeader>
               <CardTitle>Orçado vs Realizado por Mês</CardTitle>
               <CardDescription>
                  Comparação mensal entre valores planejados e realizados
               </CardDescription>
            </CardHeader>
            <CardContent>
               <ChartContainer className="h-[300px] w-full" config={chartConfig}>
                  <BarChart data={monthlyData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="month" fontSize={12} tickLine={false} />
                     <YAxis
                        fontSize={12}
                        tickFormatter={(value) =>
                           formatDecimalCurrency(value).replace("R$", "")
                        }
                        tickLine={false}
                     />
                     <ChartTooltip
                        content={
                           <ChartTooltipContent
                              formatter={(value) =>
                                 formatDecimalCurrency(Number(value))
                              }
                           />
                        }
                     />
                     <Legend />
                     <Bar
                        dataKey="budgeted"
                        fill="var(--color-budgeted)"
                        name="Orçado"
                        radius={[4, 4, 0, 0]}
                     />
                     <Bar
                        dataKey="actual"
                        fill="var(--color-actual)"
                        name="Realizado"
                        radius={[4, 4, 0, 0]}
                     />
                  </BarChart>
               </ChartContainer>
            </CardContent>
         </Card>

         {snapshotData.categoryComparisons.length > 0 && (
            <Card>
               <CardHeader>
                  <CardTitle>Comparação por Categoria</CardTitle>
                  <CardDescription>
                     Orçado vs realizado por categoria
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Categoria</TableHead>
                           <TableHead className="text-right">Orçado</TableHead>
                           <TableHead className="text-right">
                              Realizado
                           </TableHead>
                           <TableHead className="text-right">Variação</TableHead>
                           <TableHead className="text-right">%</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {snapshotData.categoryComparisons.map((cat) => (
                           <TableRow key={cat.categoryId}>
                              <TableCell>
                                 <div className="flex items-center gap-2">
                                    <div
                                       className="size-3 rounded-full"
                                       style={{
                                          backgroundColor: cat.categoryColor,
                                       }}
                                    />
                                    {cat.categoryName}
                                 </div>
                              </TableCell>
                              <TableCell className="text-right">
                                 {formatDecimalCurrency(cat.budgeted)}
                              </TableCell>
                              <TableCell className="text-right">
                                 {formatDecimalCurrency(cat.actual)}
                              </TableCell>
                              <TableCell
                                 className={`text-right ${cat.variance >= 0 ? "text-emerald-600" : "text-destructive"}`}
                              >
                                 {cat.variance >= 0 ? "+" : ""}
                                 {formatDecimalCurrency(cat.variance)}
                              </TableCell>
                              <TableCell
                                 className={`text-right ${cat.variancePercent >= 0 ? "text-emerald-600" : "text-destructive"}`}
                              >
                                 {cat.variancePercent >= 0 ? "+" : ""}
                                 {cat.variancePercent.toFixed(1)}%
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         )}
      </>
   );
}

function SpendingTrendsContent({
   snapshotData,
}: {
   snapshotData: SpendingTrendsSnapshotData;
}) {
   const chartConfig: ChartConfig = {
      expenses: { color: "hsl(var(--chart-2))", label: "Despesas" },
      income: { color: "hsl(var(--chart-1))", label: "Receitas" },
      net: { color: "hsl(var(--chart-3))", label: "Líquido" },
   };

   const monthlyData = snapshotData.monthlyData.map((item) => ({
      expenses: item.expenses,
      income: item.income,
      month: `${item.month}/${item.year}`,
      net: item.net,
   }));

   const hasNoData = snapshotData.monthlyData.length === 0;

   if (hasNoData) {
      return (
         <Card>
            <CardHeader>
               <CardTitle>Tendências de Gastos</CardTitle>
               <CardDescription>
                  Não foram encontradas transações no período selecionado
               </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground">
                  Para visualizar esta análise, certifique-se de que existem
                  transações registradas no período do relatório.
               </p>
            </CardContent>
         </Card>
      );
   }

   return (
      <>
         <Card>
            <CardHeader>
               <CardTitle>Tendência Mensal</CardTitle>
               <CardDescription>
                  Evolução de receitas e despesas ao longo do tempo
               </CardDescription>
            </CardHeader>
            <CardContent>
               <ChartContainer className="h-[300px] w-full" config={chartConfig}>
                  <LineChart data={monthlyData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="month" fontSize={12} tickLine={false} />
                     <YAxis
                        fontSize={12}
                        tickFormatter={(value) =>
                           formatDecimalCurrency(value).replace("R$", "")
                        }
                        tickLine={false}
                     />
                     <ChartTooltip
                        content={
                           <ChartTooltipContent
                              formatter={(value) =>
                                 formatDecimalCurrency(Number(value))
                              }
                           />
                        }
                     />
                     <Legend />
                     <Line
                        dataKey="income"
                        name="Receitas"
                        stroke="var(--color-income)"
                        strokeWidth={2}
                        type="monotone"
                     />
                     <Line
                        dataKey="expenses"
                        name="Despesas"
                        stroke="var(--color-expenses)"
                        strokeWidth={2}
                        type="monotone"
                     />
                     <Line
                        dataKey="net"
                        name="Líquido"
                        stroke="var(--color-net)"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        type="monotone"
                     />
                  </LineChart>
               </ChartContainer>
            </CardContent>
         </Card>

         {snapshotData.yoyComparison && (
            <Card>
               <CardHeader>
                  <CardTitle>Comparação Ano a Ano</CardTitle>
                  <CardDescription>
                     Variação em relação ao ano anterior
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                     <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                           Ano Atual
                        </p>
                        <p className="text-2xl font-bold">
                           {formatDecimalCurrency(
                              snapshotData.yoyComparison.currentYearTotal,
                           )}
                        </p>
                     </div>
                     <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                           Ano Anterior
                        </p>
                        <p className="text-2xl font-bold">
                           {formatDecimalCurrency(
                              snapshotData.yoyComparison.previousYearTotal,
                           )}
                        </p>
                     </div>
                     <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Variação</p>
                        <p
                           className={`text-2xl font-bold ${snapshotData.yoyComparison.change >= 0 ? "text-emerald-600" : "text-destructive"}`}
                        >
                           {snapshotData.yoyComparison.change >= 0 ? "+" : ""}
                           {snapshotData.yoyComparison.changePercent.toFixed(1)}%
                        </p>
                     </div>
                  </div>
               </CardContent>
            </Card>
         )}

         {snapshotData.categoryTrends.length > 0 && (
            <Card>
               <CardHeader>
                  <CardTitle>Tendências por Categoria</CardTitle>
                  <CardDescription>
                     Categorias com maior volume no período
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="space-y-4">
                     {snapshotData.categoryTrends.slice(0, 5).map((cat) => (
                        <div
                           className="flex items-center justify-between"
                           key={cat.categoryId}
                        >
                           <div className="flex items-center gap-2">
                              <div
                                 className="size-3 rounded-full"
                                 style={{ backgroundColor: cat.categoryColor }}
                              />
                              <span>{cat.categoryName}</span>
                           </div>
                           <span className="font-medium">
                              {formatDecimalCurrency(cat.totalAmount)}
                           </span>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         )}
      </>
   );
}

function CashFlowForecastContent({
   snapshotData,
}: {
   snapshotData: CashFlowForecastSnapshotData;
}) {
   const chartConfig: ChartConfig = {
      balance: { color: "hsl(var(--chart-1))", label: "Saldo" },
   };

   const projectionData = snapshotData.dailyProjections.map((item) => ({
      balance: item.balance,
      date: formatDate(new Date(item.date), "DD/MM"),
   }));

   const hasNoData =
      snapshotData.dailyProjections.length === 0 &&
      snapshotData.upcomingBills.length === 0;

   if (hasNoData) {
      return (
         <Card>
            <CardHeader>
               <CardTitle>Previsão de Fluxo de Caixa</CardTitle>
               <CardDescription>
                  Não foram encontradas projeções para o período selecionado
               </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground">
                  Para visualizar esta análise, certifique-se de que existem
                  contas programadas ou padrões de transações recorrentes.
               </p>
            </CardContent>
         </Card>
      );
   }

   return (
      <>
         <Card>
            <CardHeader>
               <CardTitle>Projeção de Saldo</CardTitle>
               <CardDescription>
                  Evolução projetada do saldo ao longo do período
               </CardDescription>
            </CardHeader>
            <CardContent>
               <ChartContainer className="h-[300px] w-full" config={chartConfig}>
                  <LineChart data={projectionData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="date" fontSize={12} tickLine={false} />
                     <YAxis
                        fontSize={12}
                        tickFormatter={(value) =>
                           formatDecimalCurrency(value).replace("R$", "")
                        }
                        tickLine={false}
                     />
                     <ChartTooltip
                        content={
                           <ChartTooltipContent
                              formatter={(value) =>
                                 formatDecimalCurrency(Number(value))
                              }
                           />
                        }
                     />
                     <Line
                        dataKey="balance"
                        name="Saldo"
                        stroke="var(--color-balance)"
                        strokeWidth={2}
                        type="monotone"
                     />
                  </LineChart>
               </ChartContainer>
            </CardContent>
         </Card>

         {snapshotData.upcomingBills.length > 0 && (
            <Card>
               <CardHeader>
                  <CardTitle>Contas a Vencer</CardTitle>
                  <CardDescription>
                     Contas programadas para o período
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Descrição</TableHead>
                           <TableHead>Contraparte</TableHead>
                           <TableHead>Vencimento</TableHead>
                           <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {snapshotData.upcomingBills.map((bill) => (
                           <TableRow key={bill.billId}>
                              <TableCell>{bill.description}</TableCell>
                              <TableCell>
                                 {bill.counterpartyName || "-"}
                              </TableCell>
                              <TableCell>
                                 {formatDate(new Date(bill.dueDate), "DD/MM/YYYY")}
                              </TableCell>
                              <TableCell
                                 className={`text-right ${bill.type === "income" ? "text-emerald-600" : "text-destructive"}`}
                              >
                                 {bill.type === "income" ? "+" : "-"}
                                 {formatDecimalCurrency(bill.amount)}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         )}

         {snapshotData.recurringPatterns.length > 0 && (
            <Card>
               <CardHeader>
                  <CardTitle>Padrões Recorrentes</CardTitle>
                  <CardDescription>
                     Transações recorrentes identificadas
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="space-y-3">
                     {snapshotData.recurringPatterns.map((pattern, index) => (
                        <div
                           className="flex items-center justify-between border-b pb-2 last:border-0"
                           key={`pattern-${index + 1}`}
                        >
                           <div>
                              <p className="font-medium">{pattern.description}</p>
                              <p className="text-sm text-muted-foreground">
                                 {pattern.frequency}
                              </p>
                           </div>
                           <span
                              className={`font-medium ${pattern.type === "income" ? "text-emerald-600" : "text-destructive"}`}
                           >
                              {pattern.type === "income" ? "+" : "-"}
                              {formatDecimalCurrency(pattern.amount)}
                           </span>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         )}
      </>
   );
}

function CounterpartyAnalysisContent({
   snapshotData,
}: {
   snapshotData: CounterpartyAnalysisSnapshotData;
}) {
   const hasNoData =
      !snapshotData.topCustomer &&
      !snapshotData.topSupplier &&
      snapshotData.customers.length === 0 &&
      snapshotData.suppliers.length === 0;

   if (hasNoData) {
      return (
         <Card>
            <CardHeader>
               <CardTitle>Análise de Contrapartes</CardTitle>
               <CardDescription>
                  Não foram encontradas transações com contrapartes no período
                  selecionado
               </CardDescription>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-muted-foreground">
                  Para visualizar esta análise, certifique-se de que existem
                  contas a pagar/receber com contrapartes associadas no período
                  do relatório.
               </p>
            </CardContent>
         </Card>
      );
   }

   return (
      <>
         <div className="grid gap-4 md:grid-cols-2">
            {snapshotData.topCustomer && (
               <Card>
                  <CardHeader>
                     <CardTitle className="text-base">Maior Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <p className="text-2xl font-bold">
                        {snapshotData.topCustomer.name}
                     </p>
                     <p className="text-sm text-muted-foreground">
                        {snapshotData.topCustomer.transactionCount} transações
                     </p>
                     <p className="mt-2 text-xl font-semibold text-emerald-600">
                        +
                        {formatDecimalCurrency(
                           snapshotData.topCustomer.totalAmount,
                        )}
                     </p>
                  </CardContent>
               </Card>
            )}

            {snapshotData.topSupplier && (
               <Card>
                  <CardHeader>
                     <CardTitle className="text-base">
                        Maior Fornecedor
                     </CardTitle>
                  </CardHeader>
                  <CardContent>
                     <p className="text-2xl font-bold">
                        {snapshotData.topSupplier.name}
                     </p>
                     <p className="text-sm text-muted-foreground">
                        {snapshotData.topSupplier.transactionCount} transações
                     </p>
                     <p className="mt-2 text-xl font-semibold text-destructive">
                        -
                        {formatDecimalCurrency(
                           snapshotData.topSupplier.totalAmount,
                        )}
                     </p>
                  </CardContent>
               </Card>
            )}
         </div>

         {snapshotData.customers.length > 0 && (
            <Card>
               <CardHeader>
                  <CardTitle>Clientes</CardTitle>
                  <CardDescription>
                     Receitas por contraparte no período
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Nome</TableHead>
                           <TableHead className="text-right">
                              Transações
                           </TableHead>
                           <TableHead className="text-right">% Total</TableHead>
                           <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {snapshotData.customers.slice(0, 10).map((customer) => (
                           <TableRow key={customer.counterpartyId}>
                              <TableCell>{customer.counterpartyName}</TableCell>
                              <TableCell className="text-right">
                                 {customer.transactionCount}
                              </TableCell>
                              <TableCell className="text-right">
                                 {customer.percentOfTotal.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right text-emerald-600">
                                 +{formatDecimalCurrency(customer.totalAmount)}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         )}

         {snapshotData.suppliers.length > 0 && (
            <Card>
               <CardHeader>
                  <CardTitle>Fornecedores</CardTitle>
                  <CardDescription>
                     Pagamentos por contraparte no período
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Nome</TableHead>
                           <TableHead className="text-right">
                              Transações
                           </TableHead>
                           <TableHead className="text-right">% Total</TableHead>
                           <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {snapshotData.suppliers.slice(0, 10).map((supplier) => (
                           <TableRow key={supplier.counterpartyId}>
                              <TableCell>{supplier.counterpartyName}</TableCell>
                              <TableCell className="text-right">
                                 {supplier.transactionCount}
                              </TableCell>
                              <TableCell className="text-right">
                                 {supplier.percentOfTotal.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right text-destructive">
                                 -{formatDecimalCurrency(supplier.totalAmount)}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         )}
      </>
   );
}

function CustomReportDetailsContent() {
   const { reportId } = routeApi.useParams();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { exportPdf, isExporting } = useExportPdf();
   const trpc = useTRPC();

   const { data: report } = useSuspenseQuery(
      trpc.customReports.getById.queryOptions({ id: reportId }),
   );

   const snapshotData = report.snapshotData as ReportSnapshotData;
   const reportType = report.type as ReportType;

   const periodLabel = `${formatDate(new Date(report.startDate), "DD/MM/YYYY")} - ${formatDate(new Date(report.endDate), "DD/MM/YYYY")}`;

   // Check if PDF export is available (only for DRE reports)
   const canExportPdf = isDREReport(reportType);

   return (
      <div className="space-y-6">
         <DefaultHeader
            actions={
               <>
                  {canExportPdf && (
                     <Button
                        disabled={isExporting}
                        onClick={() => exportPdf(report.id)}
                        variant="outline"
                     >
                        <Download className="size-4" />
                        Exportar PDF
                     </Button>
                  )}
                  <Button
                     onClick={() =>
                        openSheet({
                           children: <ManageCustomReportForm report={report} />,
                        })
                     }
                     variant="outline"
                  >
                     <Edit className="size-4" />
                     Editar
                  </Button>
               </>
            }
            description={
               report.description || "Relatório financeiro personalizado"
            }
            title={report.name}
         />

         {/* Type-specific stats cards */}
         {isDRESnapshotData(snapshotData, reportType) && (
            <DREStatsCards periodLabel={periodLabel} snapshotData={snapshotData} />
         )}
         {isBudgetVsActualSnapshotData(snapshotData, reportType) && (
            <BudgetVsActualStatsCards
               periodLabel={periodLabel}
               snapshotData={snapshotData}
            />
         )}
         {isSpendingTrendsSnapshotData(snapshotData, reportType) && (
            <SpendingTrendsStatsCards
               periodLabel={periodLabel}
               snapshotData={snapshotData}
            />
         )}
         {isCashFlowForecastSnapshotData(snapshotData, reportType) && (
            <CashFlowForecastStatsCards
               periodLabel={periodLabel}
               snapshotData={snapshotData}
            />
         )}
         {isCounterpartyAnalysisSnapshotData(snapshotData, reportType) && (
            <CounterpartyAnalysisStatsCards
               periodLabel={periodLabel}
               snapshotData={snapshotData}
            />
         )}

         {/* DRE-specific content */}
         {isDRESnapshotData(snapshotData, reportType) && (
            <>
               <FilterMetadataSection snapshotData={snapshotData} />

               {snapshotData.dreLines && (
                  <div className="grid gap-4 md:grid-cols-3">
                     <Card className="md:col-span-2">
                        <CardHeader>
                           <CardTitle>
                              DRE - Demonstração do Resultado do Exercício
                           </CardTitle>
                           <CardDescription>
                              Gerado em{" "}
                              {formatDate(
                                 new Date(snapshotData.generatedAt),
                                 "DD/MM/YYYY [às] HH:mm",
                              )}
                           </CardDescription>
                        </CardHeader>
                        <CardContent>
                           <DRETable
                              snapshotData={snapshotData}
                              type={reportType}
                           />
                        </CardContent>
                     </Card>
                     <Card>
                        <CardHeader>
                           <CardTitle className="text-base">
                              Resumo do Período
                           </CardTitle>
                           <CardDescription>{periodLabel}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                 Receita Bruta
                              </p>
                              <p className="text-2xl font-bold text-emerald-600">
                                 +
                                 {formatDecimalCurrency(
                                    snapshotData.summary.totalIncome,
                                 )}
                              </p>
                           </div>
                           <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                 Despesas Totais
                              </p>
                              <p className="text-2xl font-bold text-destructive">
                                 -
                                 {formatDecimalCurrency(
                                    snapshotData.summary.totalExpenses,
                                 )}
                              </p>
                           </div>
                           <div className="border-t pt-4 space-y-2">
                              <p className="text-sm text-muted-foreground">
                                 Resultado Líquido
                              </p>
                              <p
                                 className={`text-3xl font-bold ${
                                    snapshotData.summary.netResult >= 0
                                       ? "text-emerald-600"
                                       : "text-destructive"
                                 }`}
                              >
                                 {snapshotData.summary.netResult >= 0 ? "+" : ""}
                                 {formatDecimalCurrency(
                                    snapshotData.summary.netResult,
                                 )}
                              </p>
                              <Badge
                                 variant={
                                    snapshotData.summary.netResult >= 0
                                       ? "default"
                                       : "destructive"
                                 }
                              >
                                 {snapshotData.summary.netResult >= 0
                                    ? "Lucro"
                                    : "Prejuízo"}
                              </Badge>
                           </div>
                           {reportType === "dre_fiscal" &&
                              (() => {
                                 const dreLine9 = snapshotData.dreLines.find(
                                    (l) => l.code === "9",
                                 );
                                 const variance = dreLine9?.variance || 0;
                                 return (
                                    <div className="border-t pt-4 space-y-2">
                                       <p className="text-sm text-muted-foreground">
                                          Análise de Variação
                                       </p>
                                       <div className="grid grid-cols-2 gap-2 text-sm">
                                          <div>
                                             <p className="text-muted-foreground">
                                                Previsto
                                             </p>
                                             <p className="font-medium">
                                                {formatDecimalCurrency(
                                                   dreLine9?.plannedValue || 0,
                                                )}
                                             </p>
                                          </div>
                                          <div>
                                             <p className="text-muted-foreground">
                                                Variação
                                             </p>
                                             <p
                                                className={`font-medium ${
                                                   variance >= 0
                                                      ? "text-emerald-600"
                                                      : "text-destructive"
                                                }`}
                                             >
                                                {variance >= 0 ? "+" : ""}
                                                {formatDecimalCurrency(variance)}
                                             </p>
                                          </div>
                                       </div>
                                    </div>
                                 );
                              })()}
                        </CardContent>
                     </Card>
                  </div>
               )}

               <CategoryBreakdownSection snapshotData={snapshotData} />

               <TransactionsSection
                  slug={activeOrganization.slug}
                  snapshotData={snapshotData}
               />
            </>
         )}

         {/* Budget vs Actual content */}
         {isBudgetVsActualSnapshotData(snapshotData, reportType) && (
            <BudgetVsActualContent snapshotData={snapshotData} />
         )}

         {/* Spending Trends content */}
         {isSpendingTrendsSnapshotData(snapshotData, reportType) && (
            <SpendingTrendsContent snapshotData={snapshotData} />
         )}

         {/* Cash Flow Forecast content */}
         {isCashFlowForecastSnapshotData(snapshotData, reportType) && (
            <CashFlowForecastContent snapshotData={snapshotData} />
         )}

         {/* Counterparty Analysis content */}
         {isCounterpartyAnalysisSnapshotData(snapshotData, reportType) && (
            <CounterpartyAnalysisContent snapshotData={snapshotData} />
         )}
      </div>
   );
}

export function CustomReportDetailsPage() {
   return (
      <ErrorBoundary FallbackComponent={CustomReportDetailsErrorFallback}>
         <Suspense fallback={<CustomReportDetailsSkeleton />}>
            <CustomReportDetailsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
