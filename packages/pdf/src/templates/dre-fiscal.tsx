import type { DRESnapshotData } from "../types";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { DRETable } from "../components/dre-table";
import { FilterInfo } from "../components/filter-info";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { SummaryCards } from "../components/summary-card";
import { TransactionRow } from "../components/transaction-row";

type DREFiscalProps = {
   name: string;
   startDate: string;
   endDate: string;
   snapshotData: DRESnapshotData;
};

const TRANSACTIONS_PER_PAGE = 25;

const styles = StyleSheet.create({
   negativeVariance: {
      color: "#dc2626",
   },
   noData: {
      color: "#9ca3af",
      fontSize: 10,
      padding: 20,
      textAlign: "center",
   },
   page: {
      fontFamily: "Helvetica",
      fontSize: 10,
      padding: 40,
      paddingBottom: 60,
   },
   periodText: {
      color: "#6b7280",
      fontSize: 10,
      marginBottom: 10,
   },
   positiveVariance: {
      color: "#16a34a",
   },
   section: {
      marginBottom: 20,
   },
   sectionTitle: {
      color: "#374151",
      fontSize: 12,
      fontWeight: "bold",
      marginBottom: 10,
   },
   table: {
      borderColor: "#e5e7eb",
      borderRadius: 4,
      borderWidth: 1,
   },
   tableHeader: {
      backgroundColor: "#f3f4f6",
      borderBottomColor: "#e5e7eb",
      borderBottomWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 10,
      paddingVertical: 8,
   },
   tableHeaderCell: {
      color: "#374151",
      fontSize: 8,
      fontWeight: "bold",
      textTransform: "uppercase",
   },
   transactionsTitle: {
      color: "#111827",
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 10,
   },
   varianceItem: {
      flex: 1,
   },
   varianceLabel: {
      color: "#6b7280",
      fontSize: 9,
      marginBottom: 4,
   },
   varianceSummary: {
      backgroundColor: "#f3f4f6",
      borderRadius: 6,
      flexDirection: "row",
      gap: 15,
      marginBottom: 20,
      padding: 15,
   },
   varianceValue: {
      fontSize: 12,
      fontWeight: "bold",
   },
});

function formatCurrency(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      style: "currency",
   }).format(value);
}

function formatDate(dateStr: string): string {
   return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
   });
}

function TransactionsTableHeader() {
   return (
      <View style={styles.tableHeader}>
         <Text style={[styles.tableHeaderCell, { width: "12%" }]}>Data</Text>
         <Text style={[styles.tableHeaderCell, { width: "33%" }]}>
            Descrição
         </Text>
         <Text
            style={[
               styles.tableHeaderCell,
               { textAlign: "right", width: "15%" },
            ]}
         >
            Valor
         </Text>
         <Text style={[styles.tableHeaderCell, { width: "25%" }]}>
            Categoria
         </Text>
      </View>
   );
}

export function DREFiscalTemplate({
   name,
   startDate,
   endDate,
   snapshotData,
}: DREFiscalProps) {
   const { summary, dreLines, transactions, generatedAt, filterMetadata } =
      snapshotData;

   const totalPlanned = dreLines.reduce((acc, line) => {
      if (line.isTotal && line.code === "9") {
         return line.plannedValue || 0;
      }
      return acc;
   }, 0);

   const totalVariance = summary.netResult - totalPlanned;

   const summaryCards = [
      {
         color: "#6b7280",
         label: "Previsto",
         value: formatCurrency(totalPlanned),
      },
      {
         color: summary.netResult >= 0 ? "#16a34a" : "#dc2626",
         label: "Realizado",
         value: formatCurrency(summary.netResult),
      },
      {
         color: totalVariance >= 0 ? "#16a34a" : "#dc2626",
         label: "Variação",
         value: formatCurrency(totalVariance),
      },
      {
         color: "#2563eb",
         label: "Transações",
         value: summary.transactionCount.toString(),
      },
   ];

   const transactionPages: (typeof transactions)[] = [];
   for (let i = 0; i < transactions.length; i += TRANSACTIONS_PER_PAGE) {
      transactionPages.push(transactions.slice(i, i + TRANSACTIONS_PER_PAGE));
   }

   return (
      <Document>
         <Page size="A4" style={styles.page}>
            <Header
               reportType="dre_fiscal"
               subtitle={`${formatDate(startDate)} a ${formatDate(endDate)}`}
               title={name}
            />

            <Text style={styles.periodText}>
               Período: {formatDate(startDate)} a {formatDate(endDate)}
            </Text>

            <SummaryCards cards={summaryCards} />

            <View style={styles.varianceSummary}>
               <View style={styles.varianceItem}>
                  <Text style={styles.varianceLabel}>Receitas (Variação)</Text>
                  <Text
                     style={[
                        styles.varianceValue,
                        (dreLines.find((l) => l.code === "1")?.variance || 0) >=
                        0
                           ? styles.positiveVariance
                           : styles.negativeVariance,
                     ]}
                  >
                     {formatCurrency(
                        dreLines.find((l) => l.code === "1")?.variance || 0,
                     )}
                  </Text>
               </View>
               <View style={styles.varianceItem}>
                  <Text style={styles.varianceLabel}>Despesas (Variação)</Text>
                  <Text
                     style={[
                        styles.varianceValue,
                        (dreLines.find((l) => l.code === "6")?.variance || 0) <=
                        0
                           ? styles.positiveVariance
                           : styles.negativeVariance,
                     ]}
                  >
                     {formatCurrency(
                        dreLines.find((l) => l.code === "6")?.variance || 0,
                     )}
                  </Text>
               </View>
               <View style={styles.varianceItem}>
                  <Text style={styles.varianceLabel}>Resultado (Variação)</Text>
                  <Text
                     style={[
                        styles.varianceValue,
                        totalVariance >= 0
                           ? styles.positiveVariance
                           : styles.negativeVariance,
                     ]}
                  >
                     {formatCurrency(totalVariance)}
                  </Text>
               </View>
            </View>

            <FilterInfo filterMetadata={filterMetadata} />

            <Footer generatedAt={generatedAt} />
         </Page>

         <Page size="A4" style={styles.page}>
            <View style={styles.section}>
               <DRETable lines={dreLines} showPlanned={true} />
            </View>

            <Footer generatedAt={generatedAt} />
         </Page>

         {transactionPages.length > 0 ? (
            transactionPages.map((pageTransactions, pageIndex) => (
               <Page key={pageIndex} size="A4" style={styles.page}>
                  <Text style={styles.transactionsTitle}>
                     Transações ({transactions.length})
                     {transactionPages.length > 1 &&
                        ` - Página ${pageIndex + 1} de ${transactionPages.length}`}
                  </Text>

                  <View style={styles.table}>
                     <TransactionsTableHeader />
                     {pageTransactions.map((transaction, index) => (
                        <TransactionRow
                           key={`${pageIndex}-${index}`}
                           transaction={transaction}
                        />
                     ))}
                  </View>

                  <Footer generatedAt={generatedAt} />
               </Page>
            ))
         ) : (
            <Page size="A4" style={styles.page}>
               <Text style={styles.transactionsTitle}>Transações (0)</Text>
               <Text style={styles.noData}>Nenhuma transação encontrada</Text>
               <Footer generatedAt={generatedAt} />
            </Page>
         )}
      </Document>
   );
}
