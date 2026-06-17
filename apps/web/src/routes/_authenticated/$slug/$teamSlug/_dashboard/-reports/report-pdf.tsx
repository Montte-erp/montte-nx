/* oxlint-disable react-doctor/no-multi-comp react-doctor/only-export-components -- Componentes pequenos e coesos do documento PDF; ficam juntos para preservar consistência visual entre relatórios. */
import { format, of } from "@f-o-t/money";
import {
   Document,
   Page,
   StyleSheet,
   Text,
   View,
   pdf,
} from "@react-pdf/renderer";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";
import type { SavedReport } from "./report-labels";

type ProfitAndLossReport = Outputs["reports"]["profitAndLoss"];
type CashFlowReport = Outputs["reports"]["cashFlow"];
type CostCenterReport = Outputs["reports"]["expensesByCostCenter"];
type AgingReport = Outputs["reports"]["aging"];
type CategoryExpenseReport = Outputs["reports"]["expensesByCategory"];
type TransactionRow = Outputs["transactions"]["getAll"]["data"][number];
type TransactionStatus = "pending" | "paid";

type ReportPdfPayload =
   | { type: "dre"; data: ProfitAndLossReport; transactions: TransactionRow[] }
   | { type: "cash-flow"; data: CashFlowReport }
   | { type: "cost-centers"; data: CostCenterReport }
   | { type: "aging"; data: AgingReport }
   | { type: "categories"; data: CategoryExpenseReport };

const REPORT_TYPE_LABELS: Record<SavedReport["type"], string> = {
   dre: "Resultado / DRE",
   "cash-flow": "Fluxo de caixa",
   "cost-centers": "Centro de Custo",
   aging: "A receber / pagar",
   categories: "Despesas por categoria",
};

const percentFormatter = new Intl.NumberFormat("pt-BR", {
   style: "percent",
   maximumFractionDigits: 1,
});

const generatedAtFormatter = new Intl.DateTimeFormat("pt-BR", {
   dateStyle: "short",
   timeStyle: "short",
});

const styles = StyleSheet.create({
   page: {
      paddingTop: 26,
      paddingRight: 28,
      paddingBottom: 34,
      paddingLeft: 28,
      fontSize: 8,
      fontFamily: "Helvetica",
      color: "#111827",
      backgroundColor: "#ffffff",
   },
   header: {
      marginBottom: 18,
      padding: 14,
      borderRadius: 10,
      backgroundColor: "#111827",
      color: "#ffffff",
   },
   brandRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
   },
   brand: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.2,
      color: "#a7f3d0",
      textTransform: "uppercase",
   },
   generatedAt: {
      fontSize: 7,
      color: "#d1d5db",
   },
   title: {
      fontSize: 18,
      fontWeight: 700,
      color: "#ffffff",
      marginBottom: 5,
   },
   subtitle: {
      fontSize: 9,
      color: "#d1d5db",
   },
   metaRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 10,
   },
   pill: {
      paddingTop: 4,
      paddingRight: 7,
      paddingBottom: 4,
      paddingLeft: 7,
      borderRadius: 999,
      backgroundColor: "#1f2937",
      color: "#e5e7eb",
      fontSize: 7,
   },
   section: {
      gap: 8,
      marginBottom: 16,
   },
   sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: "#111827",
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
   },
   summary: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
   },
   summaryItem: {
      minWidth: 108,
      padding: 10,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      borderRadius: 8,
      gap: 4,
      backgroundColor: "#f9fafb",
   },
   summaryIncome: {
      borderColor: "#a7f3d0",
      backgroundColor: "#ecfdf5",
   },
   summaryExpense: {
      borderColor: "#fecaca",
      backgroundColor: "#fef2f2",
   },
   summaryLabel: {
      fontSize: 7,
      color: "#6b7280",
      textTransform: "uppercase",
      letterSpacing: 0.5,
   },
   summaryValue: {
      fontSize: 12,
      fontWeight: 700,
      color: "#111827",
   },
   table: {
      borderWidth: 1,
      borderColor: "#d1d5db",
      borderBottomWidth: 0,
      borderRadius: 6,
   },
   row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
      minHeight: 22,
   },
   headerRow: {
      backgroundColor: "#f3f4f6",
   },
   totalRow: {
      backgroundColor: "#f9fafb",
   },
   groupRow: {
      backgroundColor: "#fafafa",
   },
   cell: {
      padding: 5,
      borderRightWidth: 1,
      borderRightColor: "#e5e7eb",
      justifyContent: "center",
   },
   lastCell: {
      borderRightWidth: 0,
   },
   headText: {
      fontSize: 7,
      fontWeight: 700,
      color: "#374151",
      textTransform: "uppercase",
      letterSpacing: 0.4,
   },
   text: {
      fontSize: 8,
      lineHeight: 1.25,
   },
   strongText: {
      fontWeight: 700,
      color: "#111827",
   },
   rightText: {
      textAlign: "right",
   },
   mutedText: {
      color: "#6b7280",
   },
   incomeText: {
      color: "#047857",
   },
   expenseText: {
      color: "#b91c1c",
   },
   footer: {
      position: "absolute",
      left: 28,
      right: 28,
      bottom: 14,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: "#e5e7eb",
      flexDirection: "row",
      justifyContent: "space-between",
      color: "#6b7280",
      fontSize: 7,
   },
});

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatPercent(value: number): string {
   return percentFormatter.format(value);
}

function numberValue(value: string | number | null | undefined) {
   const parsed = Number(value ?? 0);
   return Number.isFinite(parsed) ? parsed : 0;
}

function transactionStatusFilter(
   status: SavedReport["config"]["status"],
): TransactionStatus | TransactionStatus[] {
   if (status === "all") return ["pending", "paid"];
   return status;
}

function signedAmount(row: TransactionRow) {
   const value = numberValue(row.amount);
   if (row.type === "expense") return -value;
   return value;
}

function fileSafeName(value: string) {
   return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
}

function ReportHeader({ report }: { report: SavedReport }) {
   const statusLabel =
      report.config.status === "paid"
         ? "Realizados"
         : report.config.status === "pending"
           ? "Planejados"
           : "Realizados e planejados";

   return (
      <View style={styles.header} fixed>
         <View style={styles.brandRow}>
            <Text style={styles.brand}>Montte</Text>
            <Text style={styles.generatedAt}>
               Gerado em {generatedAtFormatter.format(new Date())}
            </Text>
         </View>
         <Text style={styles.title}>{report.name}</Text>
         <Text style={styles.subtitle}>{REPORT_TYPE_LABELS[report.type]}</Text>
         <View style={styles.metaRow}>
            <Text style={styles.pill}>
               {dayjs(report.config.dateFrom).format("DD/MM/YYYY")} —{" "}
               {dayjs(report.config.dateTo).format("DD/MM/YYYY")}
            </Text>
            <Text style={styles.pill}>{statusLabel}</Text>
            {report.type === "dre" && report.config.dreOnly ? (
               <Text style={styles.pill}>Somente categorias DRE</Text>
            ) : null}
         </View>
      </View>
   );
}

type SummaryItem = {
   label: string;
   value: string;
   tone?: "income" | "expense";
};

function Summary({ items }: { items: SummaryItem[] }) {
   return (
      <View style={styles.summary}>
         {items.map((item) => (
            <View
               key={item.label}
               style={[
                  styles.summaryItem,
                  item.tone === "income" ? styles.summaryIncome : {},
                  item.tone === "expense" ? styles.summaryExpense : {},
               ]}
            >
               <Text style={styles.summaryLabel}>{item.label}</Text>
               <Text
                  style={[
                     styles.summaryValue,
                     item.tone === "income" ? styles.incomeText : {},
                     item.tone === "expense" ? styles.expenseText : {},
                  ]}
               >
                  {item.value}
               </Text>
            </View>
         ))}
      </View>
   );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
   return (
      <View style={styles.section}>
         <Text style={styles.sectionTitle}>{title}</Text>
         {children}
      </View>
   );
}

function Cell({
   children,
   width,
   header,
   last,
   right,
   muted,
   strong,
   tone,
}: {
   children: ReactNode;
   width: string;
   header?: boolean;
   last?: boolean;
   right?: boolean;
   muted?: boolean;
   strong?: boolean;
   tone?: "income" | "expense";
}) {
   return (
      <View style={[styles.cell, { width }, last ? styles.lastCell : {}]}>
         <Text
            style={[
               header ? styles.headText : styles.text,
               right ? styles.rightText : {},
               muted ? styles.mutedText : {},
               strong ? styles.strongText : {},
               tone === "income" ? styles.incomeText : {},
               tone === "expense" ? styles.expenseText : {},
            ]}
         >
            {children}
         </Text>
      </View>
   );
}

function ProfitAndLossPdf({
   report,
   transactions,
}: {
   report: ProfitAndLossReport;
   transactions: TransactionRow[];
}) {
   const income = numberValue(report.totals.income);
   const result = numberValue(report.totals.result);
   const rows = report.groups.flatMap((group) => [
      {
         id: group.id,
         name: group.name,
         type: group.type,
         total: group.total,
         periods: group.periods,
         muted: false,
      },
      ...group.rows.map((row) => ({
         id: row.id,
         name: `  ${row.name}`,
         type: group.type,
         total: row.total,
         periods: row.periods,
         muted: true,
      })),
   ]);

   return (
      <>
         <Summary
            items={[
               {
                  label: "Receita",
                  value: formatBRL(report.totals.income),
                  tone: "income",
               },
               {
                  label: "Despesas",
                  value: formatBRL(report.totals.expense),
                  tone: "expense",
               },
               {
                  label: "Resultado líquido",
                  value: formatBRL(report.totals.result),
                  tone: result < 0 ? "expense" : "income",
               },
               { label: "Lançamentos", value: String(transactions.length) },
               {
                  label: "Margem",
                  value: formatPercent(income === 0 ? 0 : result / income),
               },
            ]}
         />
         <Section title="DRE">
            <View style={styles.table}>
               <View style={[styles.row, styles.headerRow]} fixed>
                  <Cell header width="28%">
                     Grupo
                  </Cell>
                  {report.periods.map((period) => (
                     <Cell header key={period.period} right width="14%">
                        {period.label}
                     </Cell>
                  ))}
                  <Cell header last right width="16%">
                     Total
                  </Cell>
               </View>
               {rows.map((row) => (
                  <View
                     key={row.id}
                     style={[styles.row, row.muted ? {} : styles.groupRow]}
                     wrap={false}
                  >
                     <Cell muted={row.muted} strong={!row.muted} width="28%">
                        {row.name}
                     </Cell>
                     {report.periods.map((period) => (
                        <Cell
                           key={period.period}
                           muted={row.muted}
                           right
                           width="14%"
                        >
                           {formatBRL(
                              row.periods.find(
                                 (item) => item.period === period.period,
                              )?.amount ?? 0,
                           )}
                        </Cell>
                     ))}
                     <Cell
                        last
                        muted={row.muted}
                        right
                        width="16%"
                        tone={row.type === "income" ? "income" : "expense"}
                     >
                        {formatBRL(row.total)}
                     </Cell>
                  </View>
               ))}
               <View style={[styles.row, styles.totalRow]} wrap={false}>
                  <Cell strong width="28%">
                     Resultado líquido
                  </Cell>
                  {report.periods.map((period) => {
                     const income = report.groups.reduce((total, group) => {
                        if (group.type !== "income") return total;
                        return (
                           total +
                           numberValue(
                              group.periods.find(
                                 (item) => item.period === period.period,
                              )?.amount,
                           )
                        );
                     }, 0);
                     const expense = report.groups.reduce((total, group) => {
                        if (group.type !== "expense") return total;
                        return (
                           total +
                           numberValue(
                              group.periods.find(
                                 (item) => item.period === period.period,
                              )?.amount,
                           )
                        );
                     }, 0);
                     return (
                        <Cell key={period.period} right width="14%">
                           {formatBRL(income - expense)}
                        </Cell>
                     );
                  })}
                  <Cell last right width="16%">
                     {formatBRL(report.totals.result)}
                  </Cell>
               </View>
            </View>
         </Section>
         <Section title="Lançamentos da base">
            <View style={styles.table}>
               <View style={[styles.row, styles.headerRow]} fixed>
                  <Cell header width="14%">
                     Data
                  </Cell>
                  <Cell header width="28%">
                     Lançamento
                  </Cell>
                  <Cell header width="20%">
                     Categoria
                  </Cell>
                  <Cell header width="18%">
                     Centro de Custo
                  </Cell>
                  <Cell header width="10%">
                     Status
                  </Cell>
                  <Cell header last right width="10%">
                     Valor
                  </Cell>
               </View>
               {transactions.map((row) => (
                  <View key={row.id} style={styles.row} wrap={false}>
                     <Cell width="14%">
                        {dayjs(row.date).format("DD/MM/YYYY")}
                     </Cell>
                     <Cell width="28%">
                        {row.name ?? row.description ?? "Sem descrição"}
                     </Cell>
                     <Cell width="20%">
                        {row.categoryName ?? "Sem categoria"}
                     </Cell>
                     <Cell width="18%">
                        {row.tagName ?? "Sem Centro de Custo"}
                     </Cell>
                     <Cell width="10%">
                        {row.status === "paid" ? "Realizado" : "Planejado"}
                     </Cell>
                     <Cell
                        last
                        right
                        tone={signedAmount(row) < 0 ? "expense" : "income"}
                        width="10%"
                     >
                        {formatBRL(signedAmount(row))}
                     </Cell>
                  </View>
               ))}
            </View>
         </Section>
      </>
   );
}

function CashFlowPdf({ report }: { report: CashFlowReport }) {
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

   return (
      <>
         <Summary
            items={[
               { label: "Saldo inicial", value: formatBRL(initialBalance) },
               {
                  label: "Entradas",
                  value: formatBRL(totalIncome),
                  tone: "income",
               },
               {
                  label: "Saídas",
                  value: formatBRL(totalExpense),
                  tone: "expense",
               },
               {
                  label: "Saldo final",
                  value: formatBRL(endingBalance),
                  tone: endingBalance < 0 ? "expense" : "income",
               },
            ]}
         />
         <Section title="Fluxo de caixa">
            <View style={styles.table}>
               <View style={[styles.row, styles.headerRow]} fixed>
                  <Cell header width="24%">
                     Período
                  </Cell>
                  <Cell header right width="19%">
                     Saldo inicial
                  </Cell>
                  <Cell header right width="19%">
                     Entradas
                  </Cell>
                  <Cell header right width="19%">
                     Saídas
                  </Cell>
                  <Cell header last right width="19%">
                     Saldo final
                  </Cell>
               </View>
               {report.rows.map((row) => (
                  <View key={row.period} style={styles.row} wrap={false}>
                     <Cell width="24%">{row.label}</Cell>
                     <Cell right width="19%">
                        {formatBRL(row.initialBalance)}
                     </Cell>
                     <Cell right tone="income" width="19%">
                        {formatBRL(row.income)}
                     </Cell>
                     <Cell right tone="expense" width="19%">
                        {formatBRL(row.expense)}
                     </Cell>
                     <Cell last right width="19%">
                        {formatBRL(row.endingBalance)}
                     </Cell>
                  </View>
               ))}
            </View>
         </Section>
      </>
   );
}

function CostCentersPdf({ report }: { report: CostCenterReport }) {
   return (
      <>
         <Summary
            items={[
               {
                  label: "Total de despesas",
                  value: formatBRL(report.total),
                  tone: "expense",
               },
               { label: "Centros de custo", value: String(report.rows.length) },
            ]}
         />
         <Section title="Despesas por Centro de Custo">
            <View style={styles.table}>
               <View style={[styles.row, styles.headerRow]} fixed>
                  <Cell header width="34%">
                     Centro de Custo
                  </Cell>
                  <Cell header width="34%">
                     Categoria
                  </Cell>
                  <Cell header right width="16%">
                     Valor
                  </Cell>
                  <Cell header last right width="16%">
                     % do total
                  </Cell>
               </View>
               {report.rows.flatMap((row) =>
                  row.categories.map((category) => (
                     <View
                        key={`${row.id}:${category.id}`}
                        style={styles.row}
                        wrap={false}
                     >
                        <Cell width="34%">{row.name}</Cell>
                        <Cell width="34%">{category.name}</Cell>
                        <Cell right width="16%">
                           {formatBRL(category.amount)}
                        </Cell>
                        <Cell last right width="16%">
                           {formatPercent(category.percent)}
                        </Cell>
                     </View>
                  )),
               )}
            </View>
         </Section>
      </>
   );
}

function AgingPdf({ report }: { report: AgingReport }) {
   const total = report.buckets.reduce(
      (acc, bucket) => acc + numberValue(bucket.amount),
      0,
   );
   return (
      <>
         <Summary
            items={[
               { label: "Total", value: formatBRL(total) },
               ...report.buckets.map((bucket) => ({
                  label: bucket.label,
                  value: formatBRL(bucket.amount),
               })),
            ]}
         />
         <Section title="Títulos">
            <View style={styles.table}>
               <View style={[styles.row, styles.headerRow]} fixed>
                  <Cell header width="18%">
                     Categoria
                  </Cell>
                  <Cell header width="14%">
                     Tipo
                  </Cell>
                  <Cell header width="24%">
                     Lançamento
                  </Cell>
                  <Cell header width="14%">
                     Vencimento
                  </Cell>
                  <Cell header width="16%">
                     Centro de Custo
                  </Cell>
                  <Cell header last right width="14%">
                     Valor
                  </Cell>
               </View>
               {report.rows.map((row) => (
                  <View key={row.id} style={styles.row} wrap={false}>
                     <Cell width="18%">
                        {row.categoryName ?? "Sem categoria"}
                     </Cell>
                     <Cell width="14%">
                        {row.type === "income"
                           ? "A receber"
                           : row.type === "expense"
                             ? "A pagar"
                             : "Transferência"}
                     </Cell>
                     <Cell width="24%">{row.name}</Cell>
                     <Cell width="14%">
                        {dayjs(row.dueDate).format("DD/MM/YYYY")}
                     </Cell>
                     <Cell width="16%">
                        {row.tagName ?? "Sem Centro de Custo"}
                     </Cell>
                     <Cell last right width="14%">
                        {formatBRL(row.amount)}
                     </Cell>
                  </View>
               ))}
            </View>
         </Section>
      </>
   );
}

function CategoryExpensesPdf({ report }: { report: CategoryExpenseReport }) {
   const totalCount = report.rows.reduce(
      (acc, row) => acc + numberValue(row.count),
      0,
   );
   return (
      <>
         <Summary
            items={[
               {
                  label: "Total de despesas",
                  value: formatBRL(report.total),
                  tone: "expense",
               },
               { label: "Categorias", value: String(report.rows.length) },
               { label: "Lançamentos", value: String(totalCount) },
            ]}
         />
         <Section title="Despesas por categoria">
            <View style={styles.table}>
               <View style={[styles.row, styles.headerRow]} fixed>
                  <Cell header width="40%">
                     Categoria
                  </Cell>
                  <Cell header right width="20%">
                     Valor
                  </Cell>
                  <Cell header right width="20%">
                     % do total
                  </Cell>
                  <Cell header last right width="20%">
                     Lançamentos
                  </Cell>
               </View>
               {report.rows.map((row) => (
                  <View key={row.id} style={styles.row} wrap={false}>
                     <Cell width="40%">{row.name}</Cell>
                     <Cell right width="20%">
                        {formatBRL(row.amount)}
                     </Cell>
                     <Cell right width="20%">
                        {formatPercent(row.percent)}
                     </Cell>
                     <Cell last right width="20%">
                        {row.count}
                     </Cell>
                  </View>
               ))}
            </View>
         </Section>
      </>
   );
}

function PdfFooter() {
   return (
      <View fixed style={styles.footer}>
         <Text>Montte ERP · Relatório financeiro</Text>
         <Text
            render={({ pageNumber, totalPages }) =>
               `Página ${pageNumber} de ${totalPages}`
            }
         />
      </View>
   );
}

function ReportPdfDocument({
   report,
   payload,
}: {
   report: SavedReport;
   payload: ReportPdfPayload;
}) {
   return (
      <Document
         author="Montte"
         creator="Montte"
         subject={REPORT_TYPE_LABELS[report.type]}
         title={report.name}
      >
         <Page
            orientation={payload.type === "dre" ? "landscape" : "portrait"}
            size="A4"
            style={styles.page}
            wrap
         >
            <ReportHeader report={report} />
            {payload.type === "dre" ? (
               <ProfitAndLossPdf
                  report={payload.data}
                  transactions={payload.transactions}
               />
            ) : null}
            {payload.type === "cash-flow" ? (
               <CashFlowPdf report={payload.data} />
            ) : null}
            {payload.type === "cost-centers" ? (
               <CostCentersPdf report={payload.data} />
            ) : null}
            {payload.type === "aging" ? (
               <AgingPdf report={payload.data} />
            ) : null}
            {payload.type === "categories" ? (
               <CategoryExpensesPdf report={payload.data} />
            ) : null}
            <PdfFooter />
         </Page>
      </Document>
   );
}

async function loadReportPayload(
   report: SavedReport,
): Promise<ReportPdfPayload> {
   const config = report.config;

   if (report.type === "dre") {
      const input: Inputs["reports"]["profitAndLoss"] = {
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: config.status,
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
         dreOnly: config.dreOnly,
      };
      const transactionsInput: Inputs["transactions"]["getAll"] = {
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: transactionStatusFilter(config.status),
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
         all: true,
         sorting: [{ id: "date", desc: true }],
      };
      const [data, transactionsResult] = await Promise.all([
         orpc.reports.profitAndLoss.call(input),
         orpc.transactions.getAll.call(transactionsInput),
      ]);
      return {
         type: report.type,
         data,
         transactions: transactionsResult.data.filter(
            (row) => row.type !== "transfer",
         ),
      };
   }

   if (report.type === "cash-flow") {
      const input: Inputs["reports"]["cashFlow"] = {
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: config.status,
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
      };
      return {
         type: report.type,
         data: await orpc.reports.cashFlow.call(input),
      };
   }

   if (report.type === "cost-centers") {
      const input: Inputs["reports"]["expensesByCostCenter"] = {
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: config.status,
         bankAccountId: config.bankAccountId,
         categoryId: config.categoryId,
         tagId: config.tagId,
      };
      return {
         type: report.type,
         data: await orpc.reports.expensesByCostCenter.call(input),
      };
   }

   if (report.type === "aging") {
      const input: Inputs["reports"]["aging"] = {
         dateFrom: config.dateFrom,
         dateTo: config.dateTo,
         status: config.agingStatus,
         type: config.agingType,
         categoryId: config.categoryId,
         tagId: config.tagId,
      };
      return { type: report.type, data: await orpc.reports.aging.call(input) };
   }

   const input: Inputs["reports"]["expensesByCategory"] = {
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      status: config.status,
      bankAccountId: config.bankAccountId,
      categoryId: config.categoryId,
      tagId: config.tagId,
      depth: config.categoryDepth,
      minAmount: config.minAmount,
   };
   return {
      type: report.type,
      data: await orpc.reports.expensesByCategory.call(input),
   };
}

function triggerDownload(blob: Blob, filename: string) {
   const url = URL.createObjectURL(blob);
   const link = document.createElement("a");
   link.href = url;
   link.download = filename;
   document.body.appendChild(link);
   link.click();
   link.remove();
   URL.revokeObjectURL(url);
}

export async function downloadReportPdf(report: SavedReport) {
   const payload = await loadReportPayload(report);
   const blob = await pdf(
      <ReportPdfDocument payload={payload} report={report} />,
   ).toBlob();
   triggerDownload(blob, `${fileSafeName(report.name) || "relatorio"}.pdf`);
}
