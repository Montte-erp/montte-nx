import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useCallback, useMemo } from "react";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import {
   buildSubscriberColumns,
   SUBSCRIPTION_STATUS_LABEL,
   type SubscriberRow,
} from "./service-subscribers-columns";
import { ServiceTabToolbar } from "./service-tab-toolbar";

export function ServiceSubscribersTab({ serviceId }: { serviceId: string }) {
   const navigate = useNavigate();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();

   const { data: rows } = useSuspenseQuery(
      orpc.services.getSubscribers.queryOptions({ input: { serviceId } }),
   );

   const handleOpenContact = useCallback(
      (contactId: string) => {
         navigate({
            to: "/$slug/$teamSlug/contacts/$contactId",
            params: { slug, teamSlug, contactId },
            search: { tab: "servicos" },
         });
      },
      [navigate, slug, teamSlug],
   );

   const columns = useMemo(
      () => buildSubscriberColumns({ onOpenContact: handleOpenContact }),
      [handleOpenContact],
   );

   const groupBy = useCallback(
      (row: SubscriberRow) => SUBSCRIPTION_STATUS_LABEL[row.status],
      [],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={rows}
         getRowId={(r) => r.itemId}
         groupBy={groupBy}
         storageKey="montte:datatable:service-subscribers"
      >
         <ServiceTabToolbar
            serviceId={serviceId}
            searchPlaceholder="Buscar contato..."
         />
         <DataTableContent />
         <DataTableEmptyState>
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <Users className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum assinante</EmptyTitle>
                  <EmptyDescription>
                     Quando alguém assinar este serviço, aparecerá aqui.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
      </DataTableRoot>
   );
}
