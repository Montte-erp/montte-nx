import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getSortedRowModel,
   useReactTable,
   type SortingState,
} from "@tanstack/react-table";
import { Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableContainer } from "@/blocks/data-table/data-table-container";
import { DataTableEmptyState } from "@/blocks/data-table/data-table-empty-state";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTableRoot } from "@/blocks/data-table/data-table-root";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import {
   buildSubscriberColumns,
   type SubscriberRow,
} from "./service-subscribers-columns";
import { ServiceTabToolbar } from "./service-tab-toolbar";

export function ServiceSubscribersTab({ serviceId }: { serviceId: string }) {
   const navigate = useNavigate();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const layout = useDataTableLayout("service-subscribers");

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

   const [sorting, setSorting] = useState<SortingState>([]);

   const table = useReactTable({
      data: rows,
      columns,
      getRowId: (r) => r.itemId,
      state: { sorting },
      onSortingChange: setSorting,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      initialState: {
         columnSizing: layout.initialState.columnSizing,
         columnOrder: layout.initialState.columnOrder,
         columnVisibility: layout.initialState.columnVisibility,
         columnPinning: layout.initialState.columnPinning,
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
   });

   return (
      <DataTableRoot table={table}>
         <ServiceTabToolbar />
         <DataTableContainer>
            <DataTableHeader />
            <DataTableBody<SubscriberRow> />
         </DataTableContainer>
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
