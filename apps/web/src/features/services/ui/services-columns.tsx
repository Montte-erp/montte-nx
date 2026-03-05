import { formatAmount, fromMinorUnits } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";

export type ServiceRow = {
   id: string;
   name: string;
   description: string | null;
   basePrice: number;
   type: "service" | "product" | "subscription";
   categoryId: string | null;
   categoryName: string | null;
   categoryColor: string | null;
   tagId: string | null;
   tagName: string | null;
   tagColor: string | null;
   isActive: boolean;
};

const TYPE_LABELS: Record<string, string> = {
   service: "Prestação de serviço",
   product: "Produto",
   subscription: "Assinatura",
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
         accessorKey: "basePrice",
         header: "Preço padrão",
         cell: ({ row }) => {
            const money = fromMinorUnits(row.original.basePrice, "BRL");
            return <span>{formatAmount(money, "pt-BR")}</span>;
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => (
            <Badge variant="secondary">
               {TYPE_LABELS[row.original.type] ?? row.original.type}
            </Badge>
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
