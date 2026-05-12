import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { Table } from "@packages/ui/components/table";
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
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import { buildSubscriberColumns } from "./service-subscribers-columns";
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

   if (rows.length === 0) {
      return (
         <div className="flex flex-col gap-4">
            <ServiceTabToolbar />
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
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-4">
         <ServiceTabToolbar />
         <ScrollArea className="rounded-md border bg-card">
            <Table>
               <DataTableHeader table={table} />
               <DataTableBody table={table} />
            </Table>
         </ScrollArea>
      </div>
   );
}
