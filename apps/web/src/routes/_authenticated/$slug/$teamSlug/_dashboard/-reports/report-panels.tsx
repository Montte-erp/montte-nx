import { format, of } from "@f-o-t/money";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { cn } from "@packages/ui/lib/utils";
import { createCollection, useLiveQuery } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/query-core";
import dayjs from "dayjs";
import {
   AlertCircle,
   ArrowDownRight,
   ArrowUpRight,
   BarChart3,
   CircleDollarSign,
   ListChecks,
   ReceiptText,
   Scale,
   Table2,
   TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import {
   agingReportCollectionOptions,
   cashFlowReportCollectionOptions,
   categoryExpensesReportCollectionOptions,
   costCentersReportCollectionOptions,
   profitAndLossReportCollectionOptions,
   reportTransactionsCollectionOptions,
   reportTransactionsSummaryCollectionOptions,
} from "@/integrations/tanstack-db/reports";
import { type Inputs, type Outputs } from "@/integrations/orpc/client";
import type { SavedReport } from "./report-labels";

type ReportConfig = SavedReport["config"];
type ProfitAndLossReport = Outputs["reports"]["profitAndLoss"];
type CashFlowReport = Outputs["reports"]["cashFlow"];
type CostCenterReport = Outputs["reports"]["expensesByCostCenter"];
type AgingReport = Outputs["reports"]["aging"];
type CategoryExpenseReport = Outputs["reports"]["expensesByCategory"];
type TransactionRow = Outputs["transactions"]["getAll"]["data"][number];
type TransactionStatus = "pending" | "paid";

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatPercent(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      style: "percent",
      maximumFractionDigits: 1,
   }).format(value);
}

function numberValue(value: string | number | null | undefined) {
   const parsed = Number(value ?? 0);
   return Number.isFinite(parsed) ? parsed : 0;
}

function signedAmount(row: TransactionRow) {
   const value = numberValue(row.amount);
   if (row.type === "expense") return -value;
   return value;
}

function transactionStatusFilter(
   status: ReportConfig["status"],
): TransactionStatus | TransactionStatus[] {
   if (status === "all") return ["pending", "paid"];
   return status;
}

function marginValue(report: ProfitAndLossReport) {
   const income = numberValue(report.totals.income);
   if (income === 0) return 0;
   return numberValue(report.totals.result) / income;
}

export function ReportData({
   report,
   queryClient,
   teamId,
}: {
   report: SavedReport;
   queryClient: QueryClient;
   teamId: string;
}) {
   if (report.type === "dre")
      return (
         <ProfitAndLossData
            config={report.config}
            queryClient={queryClient}
            teamId={teamId}
         />
      );
   if (report.type === "cash-flow")
      return (
         <CashFlowData
            config={report.config}
            queryClient={queryClient}
            teamId={teamId}
         />
      );
   if (report.type === "cost-centers")
      return (
         <CostCentersData
            config={report.config}
            queryClient={queryClient}
            teamId={teamId}
         />
      );
   if (report.type === "aging")
      return (
         <AgingData
            config={report.config}
            queryClient={queryClient}
            teamId={teamId}
         />
      );
   return (
      <CategoryExpensesData
         config={report.config}
         queryClient={queryClient}
         teamId={teamId}
      />
   );
}

function ProfitAndLossData({
   config,
   queryClient,
   teamId,
}: {
   config: ReportConfig;
   queryClient: QueryClient;
   teamId: string;
}) {
   const reportInput = useMemo(
      () => ({
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: config.status,
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
         dreOnly: config.dreOnly,
      }),
      [
         config.dateFrom,
         config.dateTo,
         config.status,
         config.bankAccountId,
         config.categoryId,
         config.tagId,
         config.dreOnly,
      ],
   );
   const transactionsInput = useMemo<Inputs["transactions"]["getAll"]>(
      () => ({
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: transactionStatusFilter(config.status),
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
         page: 1,
         pageSize: 100,
         sorting: [{ id: "date", desc: true }],
      }),
      [
         config.dateFrom,
         config.dateTo,
         config.status,
         config.bankAccountId,
         config.categoryId,
         config.tagId,
      ],
   );
   const summaryInput = useMemo(
      () => ({
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: transactionStatusFilter(config.status),
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
      }),
      [
         config.dateFrom,
         config.dateTo,
         config.status,
         config.bankAccountId,
         config.categoryId,
         config.tagId,
      ],
   );

   const reportCollection = useMemo(
      () =>
         createCollection(
            profitAndLossReportCollectionOptions({
               queryClient,
               input: reportInput,
               teamId,
            }),
         ),
      [queryClient, teamId, reportInput],
   );
   const transactionsCollection = useMemo(
      () =>
         createCollection(
            reportTransactionsCollectionOptions({
               queryClient,
               input: transactionsInput,
               teamId,
            }),
         ),
      [queryClient, teamId, transactionsInput],
   );
   const transactionsSummaryCollection = useMemo(
      () =>
         createCollection(
            reportTransactionsSummaryCollectionOptions({
               queryClient,
               input: summaryInput,
               teamId,
            }),
         ),
      [queryClient, teamId, summaryInput],
   );
   const { data: reports, isLoading: isReportLoading } = useLiveQuery(
      (q) =>
         q.from({ report: reportCollection }).select(({ report }) => report),
      [reportCollection],
   );
   const { data: transactions, isLoading: isTransactionsLoading } =
      useLiveQuery(
         (q) =>
            q
               .from({ transaction: transactionsCollection })
               .select(({ transaction }) => transaction),
         [transactionsCollection],
      );
   const { data: summaries, isLoading: isSummaryLoading } = useLiveQuery(
      (q) =>
         q
            .from({ summary: transactionsSummaryCollection })
            .select(({ summary }) => summary),
      [transactionsSummaryCollection],
   );

   const report = reports[0];
   const transactionRows = transactions.filter(
      (row) => row.type !== "transfer",
   );
   const summary = summaries[0];
   const transactionTotal = summary?.total ?? transactions.length;

   if (
      !report ||
      isReportLoading ||
      isTransactionsLoading ||
      isSummaryLoading
   ) {
      return <EmptyReport title="Carregando relatório DRE" />;
   }

   return (
      <ProfitAndLossPanel
         report={report}
         transactions={transactionRows}
         transactionTotal={transactionTotal}
      />
   );
}

function CashFlowData({
   config,
   queryClient,
   teamId,
}: {
   config: ReportConfig;
   queryClient: QueryClient;
   teamId: string;
}) {
   const collectionInput = useMemo(
      () => ({
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: config.status,
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
      }),
      [
         config.dateFrom,
         config.dateTo,
         config.status,
         config.bankAccountId,
         config.categoryId,
         config.tagId,
      ],
   );
   const collection = useMemo(
      () =>
         createCollection(
            cashFlowReportCollectionOptions({
               queryClient,
               input: collectionInput,
               teamId,
            }),
         ),
      [queryClient, teamId, collectionInput],
   );
   const { data, isLoading: isReportLoading } = useLiveQuery(
      (q) => q.from({ report: collection }).select(({ report }) => report),
      [collection],
   );
   const report = data[0];
   if (!report || isReportLoading)
      return <EmptyReport title="Carregando fluxo de caixa" />;
   return <CashFlowPanel report={report} />;
}

function CostCentersData({
   config,
   queryClient,
   teamId,
}: {
   config: ReportConfig;
   queryClient: QueryClient;
   teamId: string;
}) {
   const collectionInput = useMemo(
      () => ({
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: config.status,
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
      }),
      [
         config.dateFrom,
         config.dateTo,
         config.status,
         config.bankAccountId,
         config.categoryId,
         config.tagId,
      ],
   );
   const collection = useMemo(
      () =>
         createCollection(
            costCentersReportCollectionOptions({
               queryClient,
               input: collectionInput,
               teamId,
            }),
         ),
      [queryClient, teamId, collectionInput],
   );
   const { data, isLoading: isReportLoading } = useLiveQuery(
      (q) => q.from({ report: collection }).select(({ report }) => report),
      [collection],
   );
   const report = data[0];
   if (!report || isReportLoading)
      return <EmptyReport title="Carregando despesas por centro de custo" />;
   return <CostCentersPanel report={report} />;
}

function AgingData({
   config,
   queryClient,
   teamId,
}: {
   config: ReportConfig;
   queryClient: QueryClient;
   teamId: string;
}) {
   const collectionInput = useMemo(
      () => ({
         type: config.agingType,
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         categoryId: config.categoryId,
         tagId: config.tagId,
         status: config.agingStatus,
      }),
      [
         config.agingType,
         config.dateFrom,
         config.dateTo,
         config.categoryId,
         config.tagId,
         config.agingStatus,
      ],
   );
   const collection = useMemo(
      () =>
         createCollection(
            agingReportCollectionOptions({
               queryClient,
               input: collectionInput,
               teamId,
            }),
         ),
      [queryClient, teamId, collectionInput],
   );
   const { data, isLoading: isReportLoading } = useLiveQuery(
      (q) => q.from({ report: collection }).select(({ report }) => report),
      [collection],
   );
   const report = data[0];
   if (!report || isReportLoading)
      return <EmptyReport title="Carregando aging" />;
   return <AgingPanel report={report} />;
}

function CategoryExpensesData({
   config,
   queryClient,
   teamId,
}: {
   config: ReportConfig;
   queryClient: QueryClient;
   teamId: string;
}) {
   const collectionInput = useMemo(
      () => ({
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: config.status,
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
         depth: config.categoryDepth,
         minAmount: config.minAmount,
      }),
      [
         config.dateFrom,
         config.dateTo,
         config.status,
         config.bankAccountId,
         config.categoryId,
         config.tagId,
         config.categoryDepth,
         config.minAmount,
      ],
   );
   const collection = useMemo(
      () =>
         createCollection(
            categoryExpensesReportCollectionOptions({
               queryClient,
               input: collectionInput,
               teamId,
            }),
         ),
      [queryClient, teamId, collectionInput],
   );
   const { data, isLoading: isReportLoading } = useLiveQuery(
      (q) => q.from({ report: collection }).select(({ report }) => report),
      [collection],
   );
   const report = data[0];
   if (!report || isReportLoading)
      return <EmptyReport title="Carregando despesas por categoria" />;
   return <CategoryExpensesPanel report={report} />;
}

function EmptyReport({ title }: { title: string }) {
   return (
      <Empty className="rounded-md border py-4">
         <EmptyHeader>
            <EmptyMedia variant="icon">
               <CircleDollarSign className="size-4" />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>
               Ajuste a configuração do relatório ou registre lançamentos para
               este período.
            </EmptyDescription>
         </EmptyHeader>
      </Empty>
   );
}

function ProfitAndLossPanel({
   report,
   transactions,
   transactionTotal,
}: {
   report: ProfitAndLossReport;
   transactions: TransactionRow[];
   transactionTotal: number;
}) {
   const hasData = report.groups.length > 0 || transactions.length > 0;

   return (
      <div className="flex flex-col gap-4">
         <ProfitAndLossSummary
            report={report}
            transactionTotal={transactionTotal}
         />
         <div className="grid gap-4 xl:grid-cols-2">
            <ProfitAndLossTrend report={report} />
            <ProfitAndLossBreakdown report={report} />
         </div>
         <ReportSection
            icon={<Table2 className="size-4" />}
            subtitle="Visão agregada por grupo contábil e período."
            title="DRE"
         >
            {report.groups.length > 0 ? (
               <ProfitAndLossTable report={report} />
            ) : (
               <EmptyReport title="Nenhum dado para DRE" />
            )}
         </ReportSection>
         <ReportSection
            icon={<ReceiptText className="size-4" />}
            subtitle="Lançamentos usados como base para este relatório."
            title="Lançamentos da snapshot"
         >
            {transactions.length > 0 ? (
               <SnapshotTransactionsTable transactions={transactions} />
            ) : (
               <EmptyReport title="Nenhum lançamento encontrado" />
            )}
         </ReportSection>
         <ReportQuality
            hasData={hasData}
            report={report}
            transactions={transactions}
            transactionTotal={transactionTotal}
         />
      </div>
   );
}

function ReportSection({
   children,
   icon,
   subtitle,
   title,
}: {
   children: ReactNode;
   icon: ReactNode;
   subtitle: string;
   title: string;
}) {
   return (
      <section className="bg-card flex flex-col gap-4 rounded-md border p-4">
         <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-2">
               <span className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
                  {icon}
               </span>
               <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="truncate text-sm font-medium">{title}</h2>
                  <p className="text-muted-foreground text-sm">{subtitle}</p>
               </div>
            </div>
         </div>
         {children}
      </section>
   );
}

function ProfitAndLossSummary({
   report,
   transactionTotal,
}: {
   report: ProfitAndLossReport;
   transactionTotal: number;
}) {
   const result = numberValue(report.totals.result);
   const items = [
      {
         label: "Receita",
         value: formatBRL(report.totals.income),
         icon: ArrowUpRight,
         tone: "text-emerald-500",
      },
      {
         label: "Despesas",
         value: formatBRL(report.totals.expense),
         icon: ArrowDownRight,
         tone: "text-destructive",
      },
      {
         label: "Resultado líquido",
         value: formatBRL(report.totals.result),
         icon: Scale,
         tone: result >= 0 ? "text-emerald-500" : "text-destructive",
      },
      {
         label: "Margem",
         value: formatPercent(marginValue(report)),
         icon: TrendingUp,
         tone: "text-muted-foreground",
      },
      {
         label: "Lançamentos",
         value: String(transactionTotal),
         icon: ListChecks,
         tone: "text-muted-foreground",
      },
   ];

   return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
         {items.map((item) => {
            const Icon = item.icon;
            return (
               <div
                  className="bg-card flex min-h-24 flex-col justify-between gap-4 rounded-md border p-4"
                  key={item.label}
               >
                  <div className="flex items-center justify-between gap-2">
                     <span className="text-muted-foreground text-sm">
                        {item.label}
                     </span>
                     <Icon className={cn("size-4", item.tone)} />
                  </div>
                  <p className="truncate text-lg font-semibold">{item.value}</p>
               </div>
            );
         })}
      </div>
   );
}

function ProfitAndLossTrend({ report }: { report: ProfitAndLossReport }) {
   const rows = report.periods.map((period) => {
      const income = report.groups.reduce((total, group) => {
         if (group.type !== "income") return total;
         const row = group.periods.find(
            (item) => item.period === period.period,
         );
         return total + numberValue(row?.amount);
      }, 0);
      const expense = report.groups.reduce((total, group) => {
         if (group.type !== "expense") return total;
         const row = group.periods.find(
            (item) => item.period === period.period,
         );
         return total + numberValue(row?.amount);
      }, 0);
      return { ...period, income, expense, result: income - expense };
   });
   const max = Math.max(
      1,
      ...rows.flatMap((row) => [row.income, row.expense, Math.abs(row.result)]),
   );

   return (
      <ReportSection
         icon={<BarChart3 className="size-4" />}
         subtitle="Receita, despesas e resultado por mês."
         title="Evolução"
      >
         <div className="flex min-h-48 items-end gap-4">
            {rows.map((row) => (
               <div className="flex flex-1 flex-col gap-2" key={row.period}>
                  <div className="flex h-40 items-end gap-2">
                     <div
                        className="bg-emerald-500/70 min-h-2 flex-1 rounded-sm"
                        style={{
                           height: `${Math.max(4, (row.income / max) * 100)}%`,
                        }}
                        title={`Receita ${formatBRL(row.income)}`}
                     />
                     <div
                        className="bg-destructive/70 min-h-2 flex-1 rounded-sm"
                        style={{
                           height: `${Math.max(4, (row.expense / max) * 100)}%`,
                        }}
                        title={`Despesas ${formatBRL(row.expense)}`}
                     />
                  </div>
                  <span className="text-muted-foreground truncate text-center text-xs">
                     {row.label}
                  </span>
               </div>
            ))}
         </div>
      </ReportSection>
   );
}

function ProfitAndLossBreakdown({ report }: { report: ProfitAndLossReport }) {
   const rows = report.groups
      .filter((group) => group.type === "expense")
      .sort((a, b) => numberValue(b.total) - numberValue(a.total))
      .slice(0, 5);
   const max = Math.max(1, ...rows.map((row) => numberValue(row.total)));

   return (
      <ReportSection
         icon={<CircleDollarSign className="size-4" />}
         subtitle="Maiores grupos de despesa no período."
         title="Composição"
      >
         {rows.length > 0 ? (
            <div className="flex min-h-48 flex-col justify-center gap-4">
               {rows.map((row) => (
                  <div className="flex flex-col gap-2" key={row.id}>
                     <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="truncate font-medium">{row.name}</span>
                        <span className="text-muted-foreground shrink-0">
                           {formatBRL(row.total)}
                        </span>
                     </div>
                     <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                           className="bg-destructive h-2 rounded-full"
                           style={{
                              width: `${(numberValue(row.total) / max) * 100}%`,
                           }}
                        />
                     </div>
                  </div>
               ))}
            </div>
         ) : (
            <EmptyReport title="Nenhuma despesa encontrada" />
         )}
      </ReportSection>
   );
}

function ProfitAndLossTable({ report }: { report: ProfitAndLossReport }) {
   return (
      <ScrollArea className="min-h-0 rounded-md border">
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Grupo</TableHead>
                  {report.periods.map((period) => (
                     <TableHead className="text-right" key={period.period}>
                        {period.label}
                     </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {report.groups.map((group) => (
                  <TableRow key={group.id}>
                     <TableCell className="font-medium">{group.name}</TableCell>
                     {group.periods.map((period) => (
                        <TableCell className="text-right" key={period.period}>
                           {formatBRL(period.amount)}
                        </TableCell>
                     ))}
                     <TableCell className="text-right font-medium">
                        {formatBRL(group.total)}
                     </TableCell>
                  </TableRow>
               ))}
               <TableRow>
                  <TableCell className="font-semibold">
                     Resultado líquido
                  </TableCell>
                  {report.periods.map((period) => {
                     const income = report.groups.reduce((total, group) => {
                        if (group.type !== "income") return total;
                        const row = group.periods.find(
                           (item) => item.period === period.period,
                        );
                        return total + numberValue(row?.amount);
                     }, 0);
                     const expense = report.groups.reduce((total, group) => {
                        if (group.type !== "expense") return total;
                        const row = group.periods.find(
                           (item) => item.period === period.period,
                        );
                        return total + numberValue(row?.amount);
                     }, 0);
                     return (
                        <TableCell
                           className="text-right font-semibold"
                           key={period.period}
                        >
                           {formatBRL(income - expense)}
                        </TableCell>
                     );
                  })}
                  <TableCell className="text-right font-semibold">
                     {formatBRL(report.totals.result)}
                  </TableCell>
               </TableRow>
            </TableBody>
         </Table>
      </ScrollArea>
   );
}

function SnapshotTransactionsTable({
   transactions,
}: {
   transactions: TransactionRow[];
}) {
   return (
      <ScrollArea className="max-h-96 min-h-0 rounded-md border">
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Lançamento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {transactions.map((row) => (
                  <TableRow key={row.id}>
                     <TableCell>
                        {dayjs(row.date).format("DD/MM/YYYY")}
                     </TableCell>
                     <TableCell className="font-medium">
                        {row.name ?? row.description ?? "Sem descrição"}
                     </TableCell>
                     <TableCell>
                        {row.categoryName ?? "Sem categoria"}
                     </TableCell>
                     <TableCell>
                        {row.tagName ?? "Sem Centro de Custo"}
                     </TableCell>
                     <TableCell>
                        {row.status === "paid" ? "Realizado" : "Planejado"}
                     </TableCell>
                     <TableCell
                        className={cn(
                           "text-right font-medium",
                           signedAmount(row) < 0
                              ? "text-destructive"
                              : "text-emerald-500",
                        )}
                     >
                        {formatBRL(signedAmount(row))}
                     </TableCell>
                  </TableRow>
               ))}
            </TableBody>
         </Table>
      </ScrollArea>
   );
}

function ReportQuality({
   hasData,
   report,
   transactions,
   transactionTotal,
}: {
   hasData: boolean;
   report: ProfitAndLossReport;
   transactions: TransactionRow[];
   transactionTotal: number;
}) {
   const uncategorized = transactions.filter((row) => !row.categoryId).length;
   const withoutCostCenter = transactions.filter((row) => !row.tagId).length;
   const omitted = Math.max(0, transactionTotal - transactions.length);
   const resultLabel =
      numberValue(report.totals.result) >= 0 ? "positivo" : "negativo";

   return (
      <ReportSection
         icon={<AlertCircle className="size-4" />}
         subtitle="Pendências e contexto da base do relatório."
         title="Qualidade do relatório"
      >
         <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QualityItem
               label="Base encontrada"
               value={
                  hasData
                     ? `${transactionTotal} lançamentos`
                     : "Nenhum lançamento"
               }
            />
            <QualityItem
               label="Sem categoria"
               value={`${uncategorized} lançamentos`}
            />
            <QualityItem
               label="Sem Centro de Custo"
               value={`${withoutCostCenter} lançamentos`}
            />
            <QualityItem label="Resultado" value={`Período ${resultLabel}`} />
         </div>
         {omitted > 0 ? (
            <p className="text-muted-foreground text-sm">
               Mostrando os 100 lançamentos mais recentes. Existem {omitted}{" "}
               lançamentos adicionais na base deste relatório.
            </p>
         ) : null}
      </ReportSection>
   );
}

function QualityItem({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex flex-col gap-1 rounded-md border p-4">
         <span className="text-muted-foreground text-sm">{label}</span>
         <span className="text-sm font-medium">{value}</span>
      </div>
   );
}

function CashFlowPanel({ report }: { report: CashFlowReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhum dado de fluxo de caixa" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Período</TableHead>
               <TableHead className="text-right">Saldo inicial</TableHead>
               <TableHead className="text-right">Entradas</TableHead>
               <TableHead className="text-right">Saídas</TableHead>
               <TableHead className="text-right">Saldo final</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.rows.map((row) => (
               <TableRow key={row.period}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.initialBalance)}
                  </TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.income)}
                  </TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.expense)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                     {formatBRL(row.endingBalance)}
                  </TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

function CostCentersPanel({ report }: { report: CostCenterReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhuma despesa por Centro de Custo" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Centro de Custo</TableHead>
               <TableHead>Categoria</TableHead>
               <TableHead className="text-right">Valor</TableHead>
               <TableHead className="text-right">% do total</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.rows.flatMap((row) =>
               row.categories.map((category) => (
                  <TableRow key={`${row.id}:${category.id}`}>
                     <TableCell className="font-medium">{row.name}</TableCell>
                     <TableCell>{category.name}</TableCell>
                     <TableCell className="text-right">
                        {formatBRL(category.amount)}
                     </TableCell>
                     <TableCell className="text-right">
                        {formatPercent(category.percent)}
                     </TableCell>
                  </TableRow>
               )),
            )}
         </TableBody>
      </Table>
   );
}

function AgingPanel({ report }: { report: AgingReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhum título encontrado" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Categoria</TableHead>
               <TableHead>Lançamento</TableHead>
               <TableHead>Vencimento</TableHead>
               <TableHead>Centro de Custo</TableHead>
               <TableHead className="text-right">Dias</TableHead>
               <TableHead className="text-right">Valor</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.rows.map((row) => (
               <TableRow key={row.id}>
                  <TableCell className="font-medium">
                     {row.categoryName ?? "Sem categoria"}
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                     {dayjs(row.dueDate).format("DD/MM/YYYY")}
                  </TableCell>
                  <TableCell>{row.tagName ?? "Sem Centro de Custo"}</TableCell>
                  <TableCell className="text-right">{row.days}</TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.amount)}
                  </TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

function CategoryExpensesPanel({ report }: { report: CategoryExpenseReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhuma despesa por categoria" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Categoria</TableHead>
               <TableHead className="text-right">Valor</TableHead>
               <TableHead className="text-right">% do total</TableHead>
               <TableHead className="text-right">Lançamentos</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.rows.map((row) => (
               <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                     {formatPercent(row.percent)}
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}
