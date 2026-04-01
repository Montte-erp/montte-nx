import { Badge } from "@packages/ui/components/badge";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import { Input } from "@packages/ui/components/input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnFiltersState, OnChangeFn, SortingState } from "@tanstack/react-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";
import { EventDefinitionsTable } from "./-event-definitions/event-definitions-table";

const eventDefinitionsSearchSchema = z.object({
   sorting: z.array(z.object({ id: z.string(), desc: z.boolean() })).optional().default([]),
   columnFilters: z.array(z.object({ id: z.string(), value: z.unknown() })).optional().default([]),
});

type EventDefinitionsSearch = z.infer<typeof eventDefinitionsSearchSchema>;

const [useEventDefinitionsTableState] = createLocalStorageState<DataTableStoredState | null>(
   "montte:datatable:event-definitions",
   null,
);

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/analytics/data-management/event-definitions",
)({
   validateSearch: eventDefinitionsSearchSchema,
   component: EventDefinitionsPage,
});

function EventDefinitionsPage() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters } = Route.useSearch();
   const [tableState, setTableState] = useEventDefinitionsTableState();
   const [search, setSearch] = useState("");
   const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

   const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      navigate({ search: (prev: EventDefinitionsSearch) => ({ ...prev, sorting: next }) });
   };

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      navigate({ search: (prev: EventDefinitionsSearch) => ({ ...prev, columnFilters: next }) });
   };

   const { data: events } = useSuspenseQuery(
      orpc.billing.getEventCatalog.queryOptions({}),
   );

   const categories = useMemo(
      () => [...new Set(events.map((e) => e.category))],
      [events],
   );

   const filtered = useMemo(() => {
      let result = events;
      if (search) {
         const q = search.toLowerCase();
         result = result.filter(
            (e) =>
               e.displayName.toLowerCase().includes(q) ||
               e.eventName.toLowerCase().includes(q),
         );
      }
      if (categoryFilter) {
         result = result.filter((e) => e.category === categoryFilter);
      }
      return result;
   }, [events, search, categoryFilter]);

   const stats = useMemo(() => {
      const total = events.length;
      const billable = events.filter((e) => e.isBillable).length;
      const free = total - billable;
      return { total, billable, free, categories: categories.length };
   }, [events, categories]);

   return (
      <div className="flex flex-col gap-6">
         <div>
            <h2 className="text-2xl font-bold tracking-tight">
               Definições de Eventos
            </h2>
            <p className="text-muted-foreground">
               Catálogo de eventos do sistema com preços e limites
            </p>
         </div>

         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
               <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                     Total de Eventos
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <p className="text-2xl font-bold">{stats.total}</p>
               </CardContent>
            </Card>
            <Card>
               <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                     Faturáveis
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <p className="text-2xl font-bold">{stats.billable}</p>
               </CardContent>
            </Card>
            <Card>
               <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                     Gratuitos
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <p className="text-2xl font-bold">{stats.free}</p>
               </CardContent>
            </Card>
            <Card>
               <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                     Categorias
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <p className="text-2xl font-bold">{stats.categories}</p>
               </CardContent>
            </Card>
         </div>

         <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
               <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
               <Input
                  className="pl-8"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar eventos..."
                  value={search}
               />
            </div>
            <div className="flex gap-2 flex-wrap">
               <Badge
                  className="cursor-pointer"
                  onClick={() => setCategoryFilter(null)}
                  variant={categoryFilter === null ? "default" : "outline"}
               >
                  Todos
               </Badge>
               {categories.map((cat) => (
                  <Badge
                     className="cursor-pointer"
                     key={cat}
                     onClick={() => setCategoryFilter(cat)}
                     variant={categoryFilter === cat ? "default" : "outline"}
                  >
                     {cat}
                  </Badge>
               ))}
            </div>
         </div>

         <EventDefinitionsTable
            data={filtered}
            sorting={sorting as SortingState}
            onSortingChange={handleSortingChange}
            columnFilters={columnFilters as ColumnFiltersState}
            onColumnFiltersChange={handleColumnFiltersChange}
            tableState={tableState}
            onTableStateChange={setTableState}
         />
      </div>
   );
}
