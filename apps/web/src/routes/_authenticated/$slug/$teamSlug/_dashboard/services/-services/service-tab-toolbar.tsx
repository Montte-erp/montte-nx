import type { ReactNode } from "react";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";

interface ServiceTabToolbarProps {
   searchPlaceholder: string;
   children?: ReactNode;
}

export function ServiceTabToolbar({
   searchPlaceholder,
   children,
}: ServiceTabToolbarProps) {
   return (
      <DataTableToolbar searchPlaceholder={searchPlaceholder}>
         {children}
      </DataTableToolbar>
   );
}
