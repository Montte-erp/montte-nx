import type { DRELineItem } from "../types";
import { StyleSheet, Text, View } from "@react-pdf/renderer";

type DRETableProps = {
   lines: DRELineItem[];
   showPlanned?: boolean;
};

const styles = StyleSheet.create({
   codeCell: {
      color: "#374151",
      fontSize: 9,
      width: "10%",
   },
   codeCellBold: {
      color: "#374151",
      fontSize: 9,
      fontWeight: "bold",
      width: "10%",
   },
   container: {
      marginBottom: 20,
   },
   headerCode: {
      color: "#374151",
      fontSize: 9,
      fontWeight: "bold",
      textTransform: "uppercase",
      width: "10%",
   },
   headerLabel: {
      color: "#374151",
      flex: 1,
      fontSize: 9,
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
   headerValue: {
      color: "#374151",
      fontSize: 9,
      fontWeight: "bold",
      textAlign: "right",
      textTransform: "uppercase",
      width: "20%",
   },
   labelCell: {
      color: "#374151",
      flex: 1,
      fontSize: 9,
   },
   labelCellBold: {
      color: "#374151",
      flex: 1,
      fontSize: 9,
      fontWeight: "bold",
   },
   labelCellMuted: {
      color: "#6b7280",
      flex: 1,
      fontSize: 9,
   },
   row: {
      borderBottomColor: "#f3f4f6",
      borderBottomWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 10,
      paddingVertical: 6,
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
   totalRow: {
      backgroundColor: "#f9fafb",
   },
   valueCell: {
      color: "#374151",
      fontSize: 9,
      textAlign: "right",
      width: "20%",
   },
   valueCellBoldNegative: {
      color: "#dc2626",
      fontSize: 9,
      fontWeight: "bold",
      textAlign: "right",
      width: "20%",
   },
   valueCellBoldPositive: {
      color: "#16a34a",
      fontSize: 9,
      fontWeight: "bold",
      textAlign: "right",
      width: "20%",
   },
   valueCellNegative: {
      color: "#dc2626",
      fontSize: 9,
      textAlign: "right",
      width: "20%",
   },
   valueCellPositive: {
      color: "#16a34a",
      fontSize: 9,
      textAlign: "right",
      width: "20%",
   },
});

function formatCurrency(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      style: "currency",
   }).format(value);
}

function getCodeStyle(isTotal: boolean) {
   return isTotal ? styles.codeCellBold : styles.codeCell;
}

function getLabelStyle(isTotal: boolean, indent: number) {
   if (indent > 0) return styles.labelCellMuted;
   if (isTotal) return styles.labelCellBold;
   return styles.labelCell;
}

function getValueStyle(isTotal: boolean, value: number) {
   if (isTotal) {
      return value >= 0
         ? styles.valueCellBoldPositive
         : styles.valueCellBoldNegative;
   }
   return value >= 0 ? styles.valueCellPositive : styles.valueCellNegative;
}

function getVarianceStyle(variance: number) {
   return variance >= 0 ? styles.valueCellPositive : styles.valueCellNegative;
}

export function DRETable({ lines, showPlanned = false }: DRETableProps) {
   return (
      <View style={styles.container}>
         <Text style={styles.title}>Demonstrativo de Resultado</Text>

         <View style={styles.table}>
            <View style={styles.headerRow}>
               <Text style={styles.headerCode}>Código</Text>
               <Text style={styles.headerLabel}>Descrição</Text>
               {showPlanned && (
                  <>
                     <Text style={styles.headerValue}>Previsto</Text>
                     <Text style={styles.headerValue}>Realizado</Text>
                     <Text style={styles.headerValue}>Variação</Text>
                  </>
               )}
               {!showPlanned && <Text style={styles.headerValue}>Valor</Text>}
            </View>

            {lines.map((line, index) => (
               <View
                  key={index}
                  style={
                     line.isTotal ? [styles.row, styles.totalRow] : styles.row
                  }
               >
                  <Text style={getCodeStyle(line.isTotal)}>{line.code}</Text>
                  <Text
                     style={[
                        getLabelStyle(line.isTotal, line.indent),
                        { paddingLeft: line.indent * 10 },
                     ]}
                  >
                     {line.label}
                  </Text>

                  {showPlanned && (
                     <>
                        <Text style={styles.valueCell}>
                           {formatCurrency(line.plannedValue || 0)}
                        </Text>
                        <Text style={styles.valueCell}>
                           {formatCurrency(line.value)}
                        </Text>
                        <Text style={getVarianceStyle(line.variance || 0)}>
                           {formatCurrency(line.variance || 0)}
                        </Text>
                     </>
                  )}

                  {!showPlanned && (
                     <Text style={getValueStyle(line.isTotal, line.value)}>
                        {formatCurrency(line.value)}
                     </Text>
                  )}
               </View>
            ))}
         </View>
      </View>
   );
}
