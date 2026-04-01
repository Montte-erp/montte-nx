import { Badge } from "@packages/ui/components/badge";
import {
   DataTable,
   type DataTableStoredState,
} from "@packages/ui/components/data-table";
import { Switch } from "@packages/ui/components/switch";
import type {
   ColumnDef,
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { BookOpen } from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";

type EventEntry = Outputs["billing"]["getEventCatalog"][number];

const categoryColors: Record<string, string> = {
   content: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
   ai: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
   platform:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
   forms: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const columns: ColumnDef<EventEntry>[] = [
   {
      accessorKey: "displayName",
      header: "Evento",
      cell: ({ row }) => (
         <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.original.displayName}</span>
            <span className="text-xs text-muted-foreground font-mono">
               {row.original.eventName}
            </span>
         </div>
      ),
   },
   {
      accessorKey: "category",
      header: "Categoria",
      cell: ({ row }) => (
         <Badge
            className={categoryColors[row.original.category] ?? ""}
            variant="secondary"
         >
            {row.original.category}
         </Badge>
      ),
   },
   {
      accessorKey: "pricePerEvent",
      header: "Preço/Evento",
      cell: ({ row }) => (
         <span className="font-mono text-sm">
            R$ {row.original.pricePerEvent}
         </span>
      ),
   },
   {
      accessorKey: "freeTierLimit",
      header: "Limite Free",
      cell: ({ row }) => (
         <span className="text-sm">
            {row.original.freeTierLimit.toLocaleString("pt-BR")}
         </span>
      ),
   },
   {
      accessorKey: "isBillable",
      header: "Faturável",
      cell: ({ row }) => (
         <Badge variant={row.original.isBillable ? "default" : "secondary"}>
            {row.original.isBillable ? "Sim" : "Não"}
         </Badge>
      ),
   },
   {
      accessorKey: "isActive",
      header: "Ativo",
      cell: ({ row }) => <Switch checked={row.original.isActive} disabled />,
   },
];

interface EventDefinitionsTableProps {
   data: EventEntry[];
   sorting: SortingState;
   onSortingChange: OnChangeFn<SortingState>;
   columnFilters: ColumnFiltersState;
   onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
   tableState: DataTableStoredState | null;
   onTableStateChange: (state: DataTableStoredState) => void;
}

export function EventDefinitionsTable({
   data,
   sorting,
   onSortingChange,
   columnFilters,
   onColumnFiltersChange,
   tableState,
   onTableStateChange,
}: EventDefinitionsTableProps) {
   if (data.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum evento encontrado</p>
         </div>
      );
   }

   return (
      <DataTable
         columns={columns}
         data={data}
         getRowId={(row) => row.id}
         sorting={sorting}
         onSortingChange={onSortingChange}
         columnFilters={columnFilters}
         onColumnFiltersChange={onColumnFiltersChange}
         tableState={tableState}
         onTableStateChange={onTableStateChange}
      />
   );
}
