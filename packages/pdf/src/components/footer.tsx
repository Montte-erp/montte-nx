import { StyleSheet, Text, View } from "@react-pdf/renderer";

type FooterProps = {
   generatedAt?: string;
};

const styles = StyleSheet.create({
   container: {
      borderTop: "1 solid #e5e7eb",
      bottom: 20,
      flexDirection: "row",
      justifyContent: "space-between",
      left: 40,
      paddingTop: 10,
      position: "absolute",
      right: 40,
   },
   text: {
      color: "#9ca3af",
      fontSize: 8,
   },
});

export function Footer({ generatedAt }: FooterProps) {
   const dateToFormat = generatedAt ?? new Date().toISOString();
   const formattedDate = new Date(dateToFormat).toLocaleDateString("pt-BR", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "2-digit",
      year: "numeric",
   });

   return (
      <View fixed style={styles.container}>
         <Text style={styles.text}>Gerado em: {formattedDate}</Text>
         <Text
            render={({ pageNumber, totalPages }) =>
               `Página ${pageNumber} de ${totalPages}`
            }
            style={styles.text}
         />
      </View>
   );
}
