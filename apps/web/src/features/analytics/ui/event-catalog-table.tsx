import { Badge } from "@packages/ui/components/badge";
import { DataTable } from "@packages/ui/components/data-table";
import { Input } from "@packages/ui/components/input";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

interface EventCatalogEntry {
   id: string;
   eventName: string;
   category: string;
   displayName: string;
   description: string | null;
   pricePerEvent: string;
   freeTierLimit: number;
   isBillable: boolean;
   isActive: boolean;
}

interface EventCatalogTableProps {
   events: EventCatalogEntry[];
}

const columns: ColumnDef<EventCatalogEntry>[] = [
   {
      id: "event",
      header: "Evento",
      cell: ({ row }) => (
         <div>
            <span className="font-mono text-sm">{row.original.eventName}</span>
            <p className="text-xs text-muted-foreground">
               {row.original.displayName}
            </p>
         </div>
      ),
   },
   {
      id: "category",
      header: "Categoria",
      cell: ({ row }) => (
         <Badge variant="secondary">{row.original.category}</Badge>
      ),
   },
   {
      id: "price",
      header: () => <span className="block text-right">Preço/evento</span>,
      cell: ({ row }) => (
         <span className="block text-right font-mono text-sm">
            R${row.original.pricePerEvent}
         </span>
      ),
   },
   {
      id: "freeTier",
      header: () => <span className="block text-right">Free tier</span>,
      cell: ({ row }) => (
         <span className="block text-right tabular-nums">
            {row.original.freeTierLimit > 0
               ? `${row.original.freeTierLimit.toLocaleString("pt-BR")}/mo`
               : "-"}
         </span>
      ),
   },
   {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
         <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Ativo" : "Inativo"}
         </Badge>
      ),
   },
];

export function EventCatalogTable({ events }: EventCatalogTableProps) {
   const [search, setSearch] = useState("");

   const filtered = useMemo(
      () =>
         events.filter(
            (event) =>
               event.eventName.toLowerCase().includes(search.toLowerCase()) ||
               event.displayName.toLowerCase().includes(search.toLowerCase()),
         ),
      [events, search],
   );

   return (
      <div className="space-y-4">
         <Input
            className="max-w-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar eventos..."
            value={search}
         />
         <DataTable
            columns={columns}
            data={filtered}
            getRowId={(row) => row.id}
         />
      </div>
   );
}
