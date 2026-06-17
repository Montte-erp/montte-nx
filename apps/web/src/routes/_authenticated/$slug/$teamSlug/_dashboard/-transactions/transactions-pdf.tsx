/* oxlint-disable react-doctor/no-multi-comp react-doctor/only-export-components -- Documento PDF isolado; componentes pequenos ficam juntos para manter o layout consistente. */
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

type TransactionRow = Outputs["transactions"]["getAll"]["data"][number];

type TransactionsPdfParams = {
   input: Inputs["transactions"]["getAll"];
   filters: string[];
   localFilters?: {
      name?: string | undefined;
      paymentMethod?: string | undefined;
      type?: "income" | "expense" | "transfer" | undefined;
   };
};

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
      flexWrap: "wrap",
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
   summary: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
   },
   summaryItem: {
      flexGrow: 1,
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
   incomeText: {
      color: "#047857",
   },
   expenseText: {
      color: "#b91c1c",
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
   mutedText: {
      color: "#6b7280",
   },
   strongText: {
      fontWeight: 700,
      color: "#111827",
   },
   rightText: {
      textAlign: "right",
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

function numberValue(value: string | number | null | undefined) {
   const parsed = Number(value ?? 0);
   return Number.isFinite(parsed) ? parsed : 0;
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

function Header({ filters }: { filters: string[] }) {
   return (
      <View fixed style={styles.header}>
         <View style={styles.brandRow}>
            <Text style={styles.brand}>Montte</Text>
            <Text style={styles.generatedAt}>
               Gerado em {generatedAtFormatter.format(new Date())}
            </Text>
         </View>
         <Text style={styles.title}>Lista de lançamentos</Text>
         <Text style={styles.subtitle}>
            Exportação operacional dos lançamentos filtrados
         </Text>
         {filters.length > 0 ? (
            <View style={styles.metaRow}>
               {filters.map((filter) => (
                  <Text key={filter} style={styles.pill}>
                     {filter}
                  </Text>
               ))}
            </View>
         ) : null}
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

function PdfFooter() {
   return (
      <View fixed style={styles.footer}>
         <Text>Montte ERP · Lançamentos</Text>
         <Text
            render={({ pageNumber, totalPages }) =>
               `Página ${pageNumber} de ${totalPages}`
            }
         />
      </View>
   );
}

function TransactionsPdfDocument({
   rows,
   filters,
}: {
   rows: TransactionRow[];
   filters: string[];
}) {
   const income = rows
      .filter((row) => row.type === "income")
      .reduce((acc, row) => acc + numberValue(row.amount), 0);
   const expense = rows
      .filter((row) => row.type === "expense")
      .reduce((acc, row) => acc + numberValue(row.amount), 0);
   const result = rows.reduce((acc, row) => acc + signedAmount(row), 0);

   return (
      <Document
         author="Montte"
         creator="Montte"
         subject="Lista de lançamentos"
         title="Lista de lançamentos"
      >
         <Page orientation="landscape" size="A4" style={styles.page} wrap>
            <Header filters={filters} />
            <Summary
               items={[
                  { label: "Lançamentos", value: String(rows.length) },
                  {
                     label: "Entradas",
                     value: formatBRL(income),
                     tone: "income",
                  },
                  {
                     label: "Saídas",
                     value: formatBRL(expense),
                     tone: "expense",
                  },
                  {
                     label: "Saldo líquido",
                     value: formatBRL(result),
                     tone: result < 0 ? "expense" : "income",
                  },
               ]}
            />
            <View style={styles.table}>
               <View fixed style={[styles.row, styles.headerRow]}>
                  <Cell header width="9%">
                     Data
                  </Cell>
                  <Cell header width="9%">
                     Venc.
                  </Cell>
                  <Cell header width="20%">
                     Lançamento
                  </Cell>
                  <Cell header width="9%">
                     Tipo
                  </Cell>
                  <Cell header width="9%">
                     Status
                  </Cell>
                  <Cell header width="13%">
                     Conta
                  </Cell>
                  <Cell header width="13%">
                     Categoria
                  </Cell>
                  <Cell header width="10%">
                     Centro de Custo
                  </Cell>
                  <Cell header last right width="8%">
                     Valor
                  </Cell>
               </View>
               {rows.map((row) => {
                  const amount = signedAmount(row);
                  return (
                     <View key={row.id} style={styles.row} wrap={false}>
                        <Cell width="9%">
                           {dayjs(row.date).format("DD/MM/YYYY")}
                        </Cell>
                        <Cell muted width="9%">
                           {row.dueDate
                              ? dayjs(row.dueDate).format("DD/MM/YYYY")
                              : "—"}
                        </Cell>
                        <Cell strong width="20%">
                           {row.name ?? row.description ?? "Sem descrição"}
                        </Cell>
                        <Cell width="9%">
                           {row.type === "income"
                              ? "Receita"
                              : row.type === "expense"
                                ? "Despesa"
                                : "Transferência"}
                        </Cell>
                        <Cell width="9%">
                           {row.status === "paid"
                              ? "Realizado"
                              : row.status === "pending"
                                ? "Planejado"
                                : "Cancelado"}
                        </Cell>
                        <Cell width="13%">
                           {row.bankAccountName ?? "Sem conta"}
                        </Cell>
                        <Cell width="13%">
                           {row.categoryName ?? "Sem categoria"}
                        </Cell>
                        <Cell width="10%">
                           {row.tagName ?? "Sem Centro de Custo"}
                        </Cell>
                        <Cell
                           last
                           right
                           tone={amount < 0 ? "expense" : "income"}
                           width="8%"
                        >
                           {formatBRL(amount)}
                        </Cell>
                     </View>
                  );
               })}
            </View>
            <PdfFooter />
         </Page>
      </Document>
   );
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

export async function downloadTransactionsPdf({
   input,
   filters,
   localFilters,
}: TransactionsPdfParams) {
   const result = await orpc.transactions.getAll.call({
      ...input,
      all: true,
   });
   const rows = result.data.filter((row) => {
      if (localFilters?.type && row.type !== localFilters.type) return false;
      if (localFilters?.paymentMethod === "__none" && row.paymentMethod) {
         return false;
      }
      if (
         localFilters?.paymentMethod &&
         localFilters.paymentMethod !== "__none" &&
         row.paymentMethod !== localFilters.paymentMethod
      ) {
         return false;
      }
      if (localFilters?.name) {
         const needle = localFilters.name.toLowerCase();
         const text =
            `${row.name ?? ""} ${row.description ?? ""}`.toLowerCase();
         return text.includes(needle);
      }
      return true;
   });
   const blob = await pdf(
      <TransactionsPdfDocument filters={filters} rows={rows} />,
   ).toBlob();
   const date = dayjs().format("YYYY-MM-DD");
   triggerDownload(blob, `${fileSafeName(`lancamentos-${date}`)}.pdf`);
}
