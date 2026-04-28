import { Badge } from "@packages/ui/components/badge";
import { format, of } from "@f-o-t/money";
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
   priceCount: number;
   subscriberCount: number;
   mrr: string;
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
         meta: { label: "Categoria" },
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
         meta: { label: "Tag" },
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
      {
         accessorKey: "priceCount",
         header: "Preços",
         meta: { label: "Preços", align: "right" as const },
         cell: ({ row }) =>
            row.original.priceCount > 0 ? (
               <Badge variant="secondary">{row.original.priceCount}</Badge>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         accessorKey: "subscriberCount",
         header: "Assinantes",
         meta: { label: "Assinantes", align: "right" as const },
         cell: ({ row }) =>
            row.original.subscriberCount > 0 ? (
               <Badge variant="secondary">{row.original.subscriberCount}</Badge>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         accessorKey: "mrr",
         header: "MRR",
         meta: { label: "MRR", align: "right" as const },
         cell: ({ row }) => {
            const value = Number(row.original.mrr);
            if (!value) return <span className="text-muted-foreground">—</span>;
            return (
               <span className="tabular-nums font-medium">
                  {format(of(row.original.mrr, "BRL"), "pt-BR")}
               </span>
            );
         },
      },
      {
         accessorKey: "isActive",
         header: "Status",
         meta: { label: "Status" },
         cell: ({ row }) => (
            <Badge variant="outline">
               {row.original.isActive ? "Ativo" : "Inativo"}
            </Badge>
         ),
      },
   ];
}
