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
import { CircleDollarSign } from "lucide-react";
import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import {
   agingReportCollectionOptions,
   cashFlowReportCollectionOptions,
   categoryExpensesReportCollectionOptions,
   costCentersReportCollectionOptions,
   profitAndLossReportCollectionOptions,
   reportTransactionsCollectionOptions,
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
const AGING_REPORT_TYPE: Inputs["reports"]["aging"]["type"] = "all";

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

function agingTypeLabel(type: "income" | "expense" | "transfer") {
   if (type === "income") return "A receber";
   if (type === "expense") return "A pagar";
   return "Transferência";
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
         all: true,
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
   const report = reports[0];
   const transactionRows = transactions.filter(
      (row) => row.type !== "transfer",
   );
   const transactionTotal = transactionRows.length;

   if (!report || isReportLoading || isTransactionsLoading) {
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
   const collectionInput = useMemo<Inputs["reports"]["aging"]>(
      () => ({
         type: AGING_REPORT_TYPE,
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         categoryId: config.categoryId,
         tagId: config.tagId,
         status: config.agingStatus,
      }),
      [
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

type SummaryItem = {
   label: string;
   value: string;
   tone?: string;
   hint?: string;
};

/** Flat statement-header strip — figures separated by dividers, no card chrome. */
function SummaryStrip({ items }: { items: SummaryItem[] }) {
   return (
      <dl className="flex flex-wrap items-stretch border-b">
         {items.map((item, index) => (
            <div
               className={cn(
                  "flex flex-col gap-2 py-4 pr-4",
                  index > 0 && "border-l pl-4",
               )}
               key={item.label}
            >
               <dt className="text-muted-foreground text-xs">{item.label}</dt>
               <dd
                  className={cn(
                     "text-lg font-semibold tabular-nums",
                     item.tone,
                  )}
               >
                  {item.value}
               </dd>
               {item.hint ? (
                  <dd className="text-muted-foreground truncate text-xs">
                     {item.hint}
                  </dd>
               ) : null}
            </div>
         ))}
      </dl>
   );
}

/** Proportion bar rendered inside a `%` table cell — table-native, not a card. */
function ShareBar({
   percent,
   color,
   barClass,
}: {
   percent: number;
   color?: string;
   barClass?: string;
}) {
   const width = Math.max(2, Math.min(100, percent * 100));
   return (
      <div className="flex items-center justify-end gap-2">
         <span className="bg-muted relative h-1.5 w-20 overflow-hidden rounded-full">
            <span
               className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  !color && (barClass ?? "bg-primary"),
               )}
               style={{
                  width: `${width}%`,
                  ...(color ? { backgroundColor: color } : {}),
               }}
            />
         </span>
         <span className="text-muted-foreground w-12 text-right tabular-nums">
            {formatPercent(percent)}
         </span>
      </div>
   );
}

function TableShell({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) {
   return (
      <ScrollArea className={cn("min-h-0 rounded-md border", className)}>
         <Table>{children}</Table>
      </ScrollArea>
   );
}

function ReportBlock({
   children,
   subtitle,
   title,
}: {
   children: ReactNode;
   subtitle?: string;
   title: string;
}) {
   return (
      <section className="flex flex-col gap-4">
         <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{title}</h2>
            {subtitle ? (
               <p className="text-muted-foreground text-sm">{subtitle}</p>
            ) : null}
         </div>
         {children}
      </section>
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
         <ReportBlock
            subtitle="Resultado por grupo contábil e período."
            title="DRE"
         >
            {report.groups.length > 0 ? (
               <ProfitAndLossTable report={report} />
            ) : (
               <EmptyReport title="Nenhum dado para DRE" />
            )}
         </ReportBlock>
         <ReportBlock
            subtitle="Lançamentos usados como base deste relatório."
            title="Lançamentos da base"
         >
            {transactions.length > 0 ? (
               <SnapshotTransactionsTable transactions={transactions} />
            ) : (
               <EmptyReport title="Nenhum lançamento encontrado" />
            )}
         </ReportBlock>
         <ReportQuality
            hasData={hasData}
            report={report}
            transactions={transactions}
            transactionTotal={transactionTotal}
         />
      </div>
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
   return (
      <SummaryStrip
         items={[
            {
               label: "Receita",
               value: formatBRL(report.totals.income),
               tone: "text-emerald-500",
            },
            {
               label: "Despesas",
               value: formatBRL(report.totals.expense),
               tone: "text-destructive",
            },
            {
               label: "Resultado líquido",
               value: formatBRL(report.totals.result),
               tone: result >= 0 ? "text-emerald-500" : "text-destructive",
            },
            {
               label: "Margem",
               value: formatPercent(marginValue(report)),
            },
            {
               label: "Lançamentos",
               value: String(transactionTotal),
            },
         ]}
      />
   );
}

type PnLGroup = ProfitAndLossReport["groups"][number];
type PnLPeriods = ProfitAndLossReport["periods"];

function sumGroupsForPeriod(
   groups: PnLGroup[],
   type: "income" | "expense",
   period: string,
) {
   return groups.reduce((total, group) => {
      if (group.type !== type) return total;
      const row = group.periods.find((item) => item.period === period);
      return total + numberValue(row?.amount);
   }, 0);
}

function PeriodAmountCells({
   periods,
   getAmount,
   className,
}: {
   periods: PnLPeriods;
   getAmount: (period: string) => number;
   className?: string;
}) {
   return (
      <>
         {periods.map((period) => (
            <TableCell
               className={cn("text-right tabular-nums", className)}
               key={period.period}
            >
               {formatBRL(getAmount(period.period))}
            </TableCell>
         ))}
      </>
   );
}

const PNL_SECTIONS: {
   type: "income" | "expense";
   label: string;
   totalLabel: string;
}[] = [
   { type: "income", label: "Receitas", totalLabel: "Receita total" },
   { type: "expense", label: "Despesas", totalLabel: "Despesa total" },
];

function ProfitAndLossTable({ report }: { report: ProfitAndLossReport }) {
   return (
      <TableShell>
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
            {PNL_SECTIONS.map((section) => {
               const groups = report.groups.filter(
                  (group) => group.type === section.type,
               );
               if (groups.length === 0) return null;
               const sectionTotal =
                  section.type === "income"
                     ? report.totals.income
                     : report.totals.expense;
               return (
                  <Fragment key={section.type}>
                     <TableRow className="bg-muted/40">
                        <TableCell
                           className="text-muted-foreground text-xs font-semibold uppercase"
                           colSpan={report.periods.length + 2}
                        >
                           {section.label}
                        </TableCell>
                     </TableRow>
                     {groups.map((group) => (
                        <Fragment key={group.id}>
                           <TableRow>
                              <TableCell className="pl-4 font-medium">
                                 {group.name}
                              </TableCell>
                              <PeriodAmountCells
                                 getAmount={(period) =>
                                    numberValue(
                                       group.periods.find(
                                          (item) => item.period === period,
                                       )?.amount,
                                    )
                                 }
                                 periods={report.periods}
                              />
                              <TableCell className="text-right font-medium tabular-nums">
                                 {formatBRL(group.total)}
                              </TableCell>
                           </TableRow>
                           {group.rows.length > 1
                              ? group.rows.map((child) => (
                                   <TableRow key={child.id}>
                                      <TableCell className="text-muted-foreground pl-4">
                                         <span className="pl-4">
                                            {child.name}
                                         </span>
                                      </TableCell>
                                      <PeriodAmountCells
                                         className="text-muted-foreground"
                                         getAmount={(period) =>
                                            numberValue(
                                               child.periods.find(
                                                  (item) =>
                                                     item.period === period,
                                               )?.amount,
                                            )
                                         }
                                         periods={report.periods}
                                      />
                                      <TableCell className="text-muted-foreground text-right tabular-nums">
                                         {formatBRL(child.total)}
                                      </TableCell>
                                   </TableRow>
                                ))
                              : null}
                        </Fragment>
                     ))}
                     <TableRow className="border-t">
                        <TableCell className="pl-4 font-semibold">
                           {section.totalLabel}
                        </TableCell>
                        <PeriodAmountCells
                           className="font-semibold"
                           getAmount={(period) =>
                              sumGroupsForPeriod(groups, section.type, period)
                           }
                           periods={report.periods}
                        />
                        <TableCell className="text-right font-semibold tabular-nums">
                           {formatBRL(sectionTotal)}
                        </TableCell>
                     </TableRow>
                  </Fragment>
               );
            })}
            <TableRow className="border-y-2">
               <TableCell className="font-semibold">
                  Resultado líquido
               </TableCell>
               <PeriodAmountCells
                  className="font-semibold"
                  getAmount={(period) =>
                     sumGroupsForPeriod(report.groups, "income", period) -
                     sumGroupsForPeriod(report.groups, "expense", period)
                  }
                  periods={report.periods}
               />
               <TableCell className="text-right font-semibold tabular-nums">
                  {formatBRL(report.totals.result)}
               </TableCell>
            </TableRow>
         </TableBody>
      </TableShell>
   );
}

function SnapshotTransactionsTable({
   transactions,
}: {
   transactions: TransactionRow[];
}) {
   return (
      <TableShell className="max-h-96">
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
                  <TableCell className="tabular-nums">
                     {dayjs(row.date).format("DD/MM/YYYY")}
                  </TableCell>
                  <TableCell className="font-medium">
                     {row.name ?? row.description ?? "Sem descrição"}
                  </TableCell>
                  <TableCell>{row.categoryName ?? "Sem categoria"}</TableCell>
                  <TableCell>{row.tagName ?? "Sem Centro de Custo"}</TableCell>
                  <TableCell>
                     {row.status === "paid" ? "Realizado" : "Planejado"}
                  </TableCell>
                  <TableCell
                     className={cn(
                        "text-right font-medium tabular-nums",
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
      </TableShell>
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
   const resultLabel =
      numberValue(report.totals.result) >= 0 ? "positivo" : "negativo";

   return (
      <ReportBlock
         subtitle="Pendências e contexto da base do relatório."
         title="Qualidade do relatório"
      >
         <SummaryStrip
            items={[
               {
                  label: "Base encontrada",
                  value: hasData
                     ? `${transactionTotal} lançamentos`
                     : "Nenhum lançamento",
               },
               {
                  label: "Sem categoria",
                  value: String(uncategorized),
                  tone: uncategorized > 0 ? "text-amber-500" : undefined,
               },
               {
                  label: "Sem Centro de Custo",
                  value: String(withoutCostCenter),
                  tone: withoutCostCenter > 0 ? "text-amber-500" : undefined,
               },
               {
                  label: "Resultado",
                  value: `Período ${resultLabel}`,
               },
            ]}
         />
      </ReportBlock>
   );
}

function CashFlowPanel({ report }: { report: CashFlowReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhum dado de fluxo de caixa" />;

   const totalIncome = report.rows.reduce(
      (acc, row) => acc + numberValue(row.income),
      0,
   );
   const totalExpense = report.rows.reduce(
      (acc, row) => acc + numberValue(row.expense),
      0,
   );
   const initialBalance = numberValue(report.rows[0]?.initialBalance);
   const endingBalance = numberValue(
      report.rows[report.rows.length - 1]?.endingBalance,
   );
   const variation = endingBalance - initialBalance;

   return (
      <div className="flex flex-col gap-4">
         <SummaryStrip
            items={[
               { label: "Saldo inicial", value: formatBRL(initialBalance) },
               {
                  label: "Entradas",
                  value: formatBRL(totalIncome),
                  tone: "text-emerald-500",
               },
               {
                  label: "Saídas",
                  value: formatBRL(totalExpense),
                  tone: "text-destructive",
               },
               {
                  label: "Saldo final",
                  value: formatBRL(endingBalance),
                  tone:
                     endingBalance >= 0
                        ? "text-emerald-500"
                        : "text-destructive",
               },
               {
                  label: "Variação",
                  value: formatBRL(variation),
                  tone:
                     variation >= 0 ? "text-emerald-500" : "text-destructive",
               },
            ]}
         />
         <ReportBlock
            subtitle="Saldo e movimentação por período."
            title="Fluxo de caixa"
         >
            <TableShell>
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
                        <TableCell className="font-medium">
                           {row.label}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                           {formatBRL(row.initialBalance)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-500">
                           {formatBRL(row.income)}
                        </TableCell>
                        <TableCell className="text-destructive text-right tabular-nums">
                           {formatBRL(row.expense)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                           {formatBRL(row.endingBalance)}
                        </TableCell>
                     </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                     <TableCell className="font-semibold">Total</TableCell>
                     <TableCell className="text-right font-semibold tabular-nums">
                        {formatBRL(initialBalance)}
                     </TableCell>
                     <TableCell className="text-right font-semibold tabular-nums text-emerald-500">
                        {formatBRL(totalIncome)}
                     </TableCell>
                     <TableCell className="text-destructive text-right font-semibold tabular-nums">
                        {formatBRL(totalExpense)}
                     </TableCell>
                     <TableCell className="text-right font-semibold tabular-nums">
                        {formatBRL(endingBalance)}
                     </TableCell>
                  </TableRow>
               </TableBody>
            </TableShell>
         </ReportBlock>
      </div>
   );
}

function CostCentersPanel({ report }: { report: CostCenterReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhuma despesa por Centro de Custo" />;

   const total = numberValue(report.total);
   const top = report.rows[0];

   return (
      <div className="flex flex-col gap-4">
         <SummaryStrip
            items={[
               {
                  label: "Total de despesas",
                  value: formatBRL(total),
                  tone: "text-destructive",
               },
               {
                  label: "Centros de custo",
                  value: String(report.rows.length),
               },
               {
                  label: "Maior centro",
                  value: top?.name ?? "—",
                  hint: top
                     ? `${formatBRL(top.amount)} · ${formatPercent(top.percent)}`
                     : undefined,
               },
            ]}
         />
         <ReportBlock
            subtitle="Despesas por centro de custo e categoria."
            title="Despesas por centro de custo"
         >
            <TableShell>
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
                           <TableCell className="font-medium">
                              <span className="flex items-center gap-2">
                                 <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: row.color }}
                                 />
                                 {row.name}
                              </span>
                           </TableCell>
                           <TableCell>{category.name}</TableCell>
                           <TableCell className="text-right tabular-nums">
                              {formatBRL(category.amount)}
                           </TableCell>
                           <TableCell>
                              <ShareBar
                                 color={row.color}
                                 percent={category.percent}
                              />
                           </TableCell>
                        </TableRow>
                     )),
                  )}
                  <TableRow className="border-t-2">
                     <TableCell className="font-semibold" colSpan={2}>
                        Total
                     </TableCell>
                     <TableCell className="text-right font-semibold tabular-nums">
                        {formatBRL(total)}
                     </TableCell>
                     <TableCell className="text-muted-foreground text-right tabular-nums">
                        {formatPercent(1)}
                     </TableCell>
                  </TableRow>
               </TableBody>
            </TableShell>
         </ReportBlock>
      </div>
   );
}

const AGING_TONE: Record<string, string> = {
   due: "text-emerald-500",
   "0-30": "text-amber-500",
   "31-60": "text-orange-500",
   ">60": "text-destructive",
};
const AGING_BAR: Record<string, string> = {
   due: "bg-emerald-500",
   "0-30": "bg-amber-500",
   "31-60": "bg-orange-500",
   ">60": "bg-destructive",
};

function AgingPanel({ report }: { report: AgingReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhum título encontrado" />;

   const total = report.buckets.reduce(
      (acc, bucket) => acc + numberValue(bucket.amount),
      0,
   );

   return (
      <div className="flex flex-col gap-4">
         <SummaryStrip
            items={[
               { label: "Total", value: formatBRL(total) },
               ...report.buckets.map((bucket) => ({
                  label: bucket.label,
                  value: formatBRL(bucket.amount),
                  tone: AGING_TONE[bucket.id],
               })),
            ]}
         />
         <ReportBlock
            subtitle="Distribuição por faixa de vencimento."
            title="Faixas de vencimento"
         >
            <TableShell>
               <TableHeader>
                  <TableRow>
                     <TableHead>Faixa</TableHead>
                     <TableHead className="text-right">Valor</TableHead>
                     <TableHead className="text-right">% do total</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {report.buckets.map((bucket) => (
                     <TableRow key={bucket.id}>
                        <TableCell className="font-medium">
                           <span className="flex items-center gap-2">
                              <span
                                 className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    AGING_BAR[bucket.id] ?? "bg-primary",
                                 )}
                              />
                              {bucket.label}
                           </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                           {formatBRL(bucket.amount)}
                        </TableCell>
                        <TableCell>
                           <ShareBar
                              barClass={AGING_BAR[bucket.id]}
                              percent={
                                 total > 0
                                    ? numberValue(bucket.amount) / total
                                    : 0
                              }
                           />
                        </TableCell>
                     </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                     <TableCell className="font-semibold">Total</TableCell>
                     <TableCell className="text-right font-semibold tabular-nums">
                        {formatBRL(total)}
                     </TableCell>
                     <TableCell className="text-muted-foreground text-right tabular-nums">
                        {formatPercent(1)}
                     </TableCell>
                  </TableRow>
               </TableBody>
            </TableShell>
         </ReportBlock>
         <ReportBlock
            subtitle="Títulos a receber e a pagar no período."
            title="Títulos"
         >
            <TableShell className="max-h-96">
               <TableHeader>
                  <TableRow>
                     <TableHead>Categoria</TableHead>
                     <TableHead>Tipo</TableHead>
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
                        <TableCell>{agingTypeLabel(row.type)}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="tabular-nums">
                           {dayjs(row.dueDate).format("DD/MM/YYYY")}
                        </TableCell>
                        <TableCell>
                           {row.tagName ?? "Sem Centro de Custo"}
                        </TableCell>
                        <TableCell
                           className={cn(
                              "text-right tabular-nums",
                              AGING_TONE[row.bucket],
                           )}
                        >
                           {row.days}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                           {formatBRL(row.amount)}
                        </TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </TableShell>
         </ReportBlock>
      </div>
   );
}

function CategoryExpensesPanel({ report }: { report: CategoryExpenseReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhuma despesa por categoria" />;

   const total = numberValue(report.total);
   const totalCount = report.rows.reduce(
      (acc, row) => acc + numberValue(row.count),
      0,
   );
   const top = report.rows[0];

   return (
      <div className="flex flex-col gap-4">
         <SummaryStrip
            items={[
               {
                  label: "Total de despesas",
                  value: formatBRL(total),
                  tone: "text-destructive",
               },
               {
                  label: "Categorias",
                  value: String(report.rows.length),
               },
               {
                  label: "Lançamentos",
                  value: String(totalCount),
               },
               {
                  label: "Maior categoria",
                  value: top?.name ?? "—",
                  hint: top
                     ? `${formatBRL(top.amount)} · ${formatPercent(top.percent)}`
                     : undefined,
               },
            ]}
         />
         <ReportBlock
            subtitle="Despesas por categoria no período."
            title="Despesas por categoria"
         >
            <TableShell>
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
                        <TableCell className="font-medium">
                           <span className="flex items-center gap-2">
                              <span
                                 className="size-2 shrink-0 rounded-full"
                                 style={{ backgroundColor: row.color }}
                              />
                              {row.name}
                           </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                           {formatBRL(row.amount)}
                        </TableCell>
                        <TableCell>
                           <ShareBar color={row.color} percent={row.percent} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                           {row.count}
                        </TableCell>
                     </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                     <TableCell className="font-semibold">Total</TableCell>
                     <TableCell className="text-right font-semibold tabular-nums">
                        {formatBRL(total)}
                     </TableCell>
                     <TableCell className="text-muted-foreground text-right tabular-nums">
                        {formatPercent(1)}
                     </TableCell>
                     <TableCell className="text-right font-semibold tabular-nums">
                        {totalCount}
                     </TableCell>
                  </TableRow>
               </TableBody>
            </TableShell>
         </ReportBlock>
      </div>
   );
}
