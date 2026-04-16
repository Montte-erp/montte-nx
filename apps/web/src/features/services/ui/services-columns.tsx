import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";

export type ServiceRow = {
   id: string;
   name: string;
   description: string | null;
   basePrice: string;
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
            exportable: true,
            importable: true,
            required: true,
            fieldPatterns: ["nome", "name", "servico", "service"],
         },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "basePrice",
         header: "Preço padrão",
         meta: {
            label: "Preço padrão",
            exportable: true,
            importable: true,
            required: true,
            fieldPatterns: ["preco", "price", "valor", "value", "baseprice"],
         },
         cell: ({ row }) => (
            <span>{format(of(row.original.basePrice, "BRL"), "pt-BR")}</span>
         ),
      },
      {
         accessorKey: "description",
         header: "Descrição",
         meta: {
            label: "Descrição",
            exportable: true,
            importable: true,
            fieldPatterns: ["descricao", "description", "obs"],
         },
         cell: ({ row }) => (
            <span className="text-muted-foreground">
               {row.original.description ?? "—"}
            </span>
         ),
      },
      {
         accessorKey: "categoryName",
         header: "Categoria",
         meta: { label: "Categoria", exportable: true },
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
         header: "Centro de Custo",
         meta: { label: "Centro de Custo", exportable: true },
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
