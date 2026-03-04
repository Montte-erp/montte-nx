import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";

export type ServiceRow = {
   id: string;
   name: string;
   category: string | null;
   isActive: boolean;
};

export function buildServiceColumns(): ColumnDef<ServiceRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "category",
         header: "Categoria",
         cell: ({ row }) =>
            row.original.category ? (
               <Badge variant="outline">{row.original.category}</Badge>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         accessorKey: "isActive",
         header: "Status",
         cell: ({ row }) => (
            <Badge variant={row.original.isActive ? "default" : "secondary"}>
               {row.original.isActive ? "Ativo" : "Inativo"}
            </Badge>
         ),
      },
   ];
}
