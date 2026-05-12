import type { ReactNode } from "react";
import {
   DataTableToolbar,
   DataTableToolbarGroup,
} from "@/components/data-table-v2/data-table-toolbar";

interface ServiceTabToolbarProps {
   children?: ReactNode;
}

export function ServiceTabToolbar({ children }: ServiceTabToolbarProps) {
   return (
      <DataTableToolbar>
         <div />
         <DataTableToolbarGroup>{children}</DataTableToolbarGroup>
      </DataTableToolbar>
   );
}
