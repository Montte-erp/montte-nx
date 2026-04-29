import type { ReactNode } from "react";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { ServiceActionsMenu } from "./service-actions-menu";

interface ServiceTabToolbarProps {
   serviceId: string;
   searchPlaceholder: string;
   children?: ReactNode;
}

export function ServiceTabToolbar({
   serviceId,
   searchPlaceholder,
   children,
}: ServiceTabToolbarProps) {
   return (
      <DataTableToolbar searchPlaceholder={searchPlaceholder}>
         {children}
         <ServiceActionsMenu serviceId={serviceId} />
      </DataTableToolbar>
   );
}
