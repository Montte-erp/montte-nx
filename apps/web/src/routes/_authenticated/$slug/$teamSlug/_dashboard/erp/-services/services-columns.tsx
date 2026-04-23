import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

export type ServiceRow = {
   id: string;
   name: string;
   description: string | null;
   categoryId: string | null;
   categoryName: string | null;
   categoryColor: string | null;
   tagId: string | null;
   tagName: string | null;
   tagColor: string | null;
   isActive: boolean;
};

export function buildServiceColumns(): ColumnDef<ServiceRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            cellComponent: "text" as const,
            editSchema: z.string().min(1, "Nome é obrigatório."),
         },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "categoryName",
         header: "Categoria",
         cell: ({ row }) =>
            row.original.categoryName ? (
               <Badge
                  style={
                     row.original.categoryColor
                        ? {
                             borderColor: row.original.categoryColor,
                             color: row.original.categoryColor,
                          }
                        : undefined
                  }
                  variant="outline"
               >
                  {row.original.categoryName}
               </Badge>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         accessorKey: "tagName",
         header: "Tag",
         cell: ({ row }) =>
            row.original.tagName ? (
               <Badge
                  style={
                     row.original.tagColor
                        ? {
                             borderColor: row.original.tagColor,
                             color: row.original.tagColor,
                          }
                        : undefined
                  }
                  variant="outline"
               >
                  {row.original.tagName}
               </Badge>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
   ];
}
