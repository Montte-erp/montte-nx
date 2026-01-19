import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { FilterMetadata } from "../types";

type FilterInfoProps = {
   filterMetadata?: FilterMetadata;
};

const styles = StyleSheet.create({
   badge: {
      backgroundColor: "#f3f4f6",
      borderRadius: 3,
      marginRight: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
   },
   badgesContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
   },
   badgeText: {
      color: "#374151",
      fontSize: 8,
   },
   container: {
      backgroundColor: "#fafafa",
      borderColor: "#e5e7eb",
      borderRadius: 6,
      borderWidth: 1,
      marginBottom: 20,
      padding: 12,
   },
   filterGroup: {
      marginBottom: 8,
   },
   filterLabel: {
      color: "#6b7280",
      fontSize: 9,
      marginBottom: 4,
   },
   title: {
      color: "#374151",
      fontSize: 10,
      fontWeight: "bold",
      marginBottom: 10,
   },
});

export function FilterInfo({ filterMetadata }: FilterInfoProps) {
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
      <View style={styles.container}>
         <Text style={styles.title}>Filtros Aplicados</Text>

         {filterMetadata.bankAccounts &&
            filterMetadata.bankAccounts.length > 0 && (
               <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Contas Bancárias</Text>
                  <View style={styles.badgesContainer}>
                     {filterMetadata.bankAccounts.map((item) => (
                        <View key={item.id} style={styles.badge}>
                           <Text style={styles.badgeText}>{item.name}</Text>
                        </View>
                     ))}
                  </View>
               </View>
            )}

         {filterMetadata.categories && filterMetadata.categories.length > 0 && (
            <View style={styles.filterGroup}>
               <Text style={styles.filterLabel}>Categorias</Text>
               <View style={styles.badgesContainer}>
                  {filterMetadata.categories.map((item) => (
                     <View key={item.id} style={styles.badge}>
                        <Text style={styles.badgeText}>{item.name}</Text>
                     </View>
                  ))}
               </View>
            </View>
         )}

         {filterMetadata.costCenters &&
            filterMetadata.costCenters.length > 0 && (
               <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Centros de Custo</Text>
                  <View style={styles.badgesContainer}>
                     {filterMetadata.costCenters.map((item) => (
                        <View key={item.id} style={styles.badge}>
                           <Text style={styles.badgeText}>{item.name}</Text>
                        </View>
                     ))}
                  </View>
               </View>
            )}

         {filterMetadata.tags && filterMetadata.tags.length > 0 && (
            <View style={styles.filterGroup}>
               <Text style={styles.filterLabel}>Tags</Text>
               <View style={styles.badgesContainer}>
                  {filterMetadata.tags.map((item) => (
                     <View key={item.id} style={styles.badge}>
                        <Text style={styles.badgeText}>{item.name}</Text>
                     </View>
                  ))}
               </View>
            </View>
         )}
      </View>
   );
}
