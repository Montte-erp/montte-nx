import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

export type ServiceRow = {
   id: string;
   name: string;
   category: string | null;
   isActive: boolean;
};

export function buildServiceColumns(
   onEdit: (row: ServiceRow) => void,
   onDelete: (row: ServiceRow) => void,
): ColumnDef<ServiceRow>[] {
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
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper
            <div
               className="flex items-center justify-end gap-1"
               onClick={(e) => e.stopPropagation()}
               onKeyDown={(e) => e.stopPropagation()}
            >
               <Button
                  onClick={() => onEdit(row.original)}
                  tooltip="Editar"
                  variant="outline"
               >
                  <Pencil className="size-4" />
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original)}
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </div>
         ),
      },
   ];
}
