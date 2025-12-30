import type {
   DRESnapshotData,
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
import { Cell, Pie, PieChart } from "recharts";
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

function CustomReportDetailsContent() {
   const { reportId } = routeApi.useParams();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { exportPdf, isExporting } = useExportPdf();
   const trpc = useTRPC();

   const { data: report } = useSuspenseQuery(
      trpc.customReports.getById.queryOptions({ id: reportId }),
   );

   const snapshotData = report.snapshotData as DRESnapshotData;

   const periodLabel = `${formatDate(new Date(report.startDate), "DD/MM/YYYY")} - ${formatDate(new Date(report.endDate), "DD/MM/YYYY")}`;

   return (
      <div className="space-y-6">
         <DefaultHeader
            actions={
               <>
                  <Button
                     disabled={isExporting}
                     onClick={() => exportPdf(report.id)}
                     variant="outline"
                  >
                     <Download className="size-4" />
                     Exportar PDF
                  </Button>
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

         <FilterMetadataSection snapshotData={snapshotData} />

         {(report.type === "dre_gerencial" || report.type === "dre_fiscal") &&
            snapshotData.dreLines && (
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
                           type={report.type}
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
                        {report.type === "dre_fiscal" &&
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
