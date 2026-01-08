import type { TransactionSnapshot } from "../types";
import { StyleSheet, Text, View } from "@react-pdf/renderer";

type TransactionRowProps = {
   transaction: TransactionSnapshot;
};

type TransactionsListProps = {
   transactions: TransactionSnapshot[];
};

const styles = StyleSheet.create({
   amountCellNegative: {
      color: "#dc2626",
      fontSize: 8,
      textAlign: "right",
      width: "15%",
   },
   amountCellPositive: {
      color: "#16a34a",
      fontSize: 8,
      textAlign: "right",
      width: "15%",
   },
   categoryCell: {
      color: "#374151",
      fontSize: 8,
      width: "25%",
   },
   categoryDot: {
      borderRadius: 2,
      height: 6,
      marginRight: 4,
      width: 6,
   },
   categoryRow: {
      alignItems: "center",
      flexDirection: "row",
   },
   container: {
      marginBottom: 20,
   },
   dateCell: {
      color: "#374151",
      fontSize: 8,
      width: "12%",
   },
   descCell: {
      color: "#374151",
      fontSize: 8,
      width: "33%",
   },
   expandedRow: {
      backgroundColor: "#f9fafb",
      borderBottomColor: "#e5e7eb",
      borderBottomWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
   },
   headerCell: {
      color: "#374151",
      fontSize: 8,
      fontWeight: "bold",
      textTransform: "uppercase",
   },
   headerRow: {
      backgroundColor: "#f3f4f6",
      borderBottomColor: "#e5e7eb",
      borderBottomWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 10,
      paddingVertical: 8,
   },
   noData: {
      color: "#9ca3af",
      fontSize: 10,
      padding: 20,
      textAlign: "center",
   },
   row: {
      borderBottomColor: "#f3f4f6",
      borderBottomWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 10,
      paddingVertical: 6,
   },
   splitAmount: {
      color: "#374151",
      fontSize: 7,
      textAlign: "right",
      width: 60,
   },
   splitCategory: {
      color: "#374151",
      fontSize: 7,
      flex: 1,
   },
   splitDot: {
      borderRadius: 2,
      height: 5,
      marginRight: 4,
      width: 5,
   },
   splitItem: {
      alignItems: "center",
      flexDirection: "row",
      marginRight: 12,
   },
   splitLabel: {
      color: "#6b7280",
      fontSize: 7,
      marginRight: 8,
   },
   splitsContainer: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
   },
   table: {
      borderColor: "#e5e7eb",
      borderRadius: 4,
      borderWidth: 1,
   },
   title: {
      color: "#111827",
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 10,
   },
});

function formatCurrency(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      style: "currency",
   }).format(Math.abs(value));
}

function formatDate(dateStr: string): string {
   return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
   });
}

export function TransactionRow({ transaction }: TransactionRowProps) {
   const isIncome = transaction.type === "income";
   const primaryCategory = transaction.transactionCategories[0]?.category;
   const hasSplits =
      transaction.categorySplits && transaction.categorySplits.length > 0;

   return (
      <View>
         <View style={styles.row}>
            <Text style={styles.dateCell}>{formatDate(transaction.date)}</Text>
            <Text style={styles.descCell}>
               {transaction.description.substring(0, 40)}
               {transaction.description.length > 40 ? "..." : ""}
            </Text>
            <Text
               style={
                  isIncome
                     ? styles.amountCellPositive
                     : styles.amountCellNegative
               }
            >
               {isIncome ? "+" : "-"}
               {formatCurrency(Number(transaction.amount))}
            </Text>
            <View style={[styles.categoryCell, styles.categoryRow]}>
               {primaryCategory && (
                  <>
                     <View
                        style={[
                           styles.categoryDot,
                           { backgroundColor: primaryCategory.color },
                        ]}
                     />
                     <Text>
                        {primaryCategory.name.substring(0, 20)}
                        {primaryCategory.name.length > 20 ? "..." : ""}
                        {hasSplits ? " (split)" : ""}
                     </Text>
                  </>
               )}
               {!primaryCategory && <Text>-</Text>}
            </View>
         </View>

         {hasSplits && (
            <View style={styles.expandedRow}>
               <View style={styles.splitsContainer}>
                  <Text style={styles.splitLabel}>Divisão:</Text>
                  {transaction.categorySplits?.map((split) => {
                     const category = transaction.transactionCategories.find(
                        (tc) => tc.category.id === split.categoryId,
                     )?.category;
                     return (
                        <View key={split.categoryId} style={styles.splitItem}>
                           <View
                              style={[
                                 styles.splitDot,
                                 {
                                    backgroundColor:
                                       category?.color || "#6b7280",
                                 },
                              ]}
                           />
                           <Text style={styles.splitCategory}>
                              {category?.name || "Sem categoria"}
                           </Text>
                           <Text style={styles.splitAmount}>
                              {formatCurrency(split.value / 100)}
                           </Text>
                        </View>
                     );
                  })}
               </View>
            </View>
         )}
      </View>
   );
}

export function TransactionsList({ transactions }: TransactionsListProps) {
   return (
      <View style={styles.container}>
         <Text style={styles.title}>Transações ({transactions.length})</Text>

         <View style={styles.table}>
            <View style={styles.headerRow}>
               <Text style={[styles.headerCell, { width: "12%" }]}>Data</Text>
               <Text style={[styles.headerCell, { width: "33%" }]}>
                  Descrição
               </Text>
               <Text
                  style={[
                     styles.headerCell,
                     { textAlign: "right", width: "15%" },
                  ]}
               >
                  Valor
               </Text>
               <Text style={[styles.headerCell, { width: "25%" }]}>
                  Categoria
               </Text>
            </View>

            {transactions.length === 0 && (
               <Text style={styles.noData}>Nenhuma transação encontrada</Text>
            )}

            {transactions.map((transaction, index) => (
               <TransactionRow
                  key={`transaction-${index + 1}`}
                  transaction={transaction}
               />
            ))}
         </View>
      </View>
   );
}
