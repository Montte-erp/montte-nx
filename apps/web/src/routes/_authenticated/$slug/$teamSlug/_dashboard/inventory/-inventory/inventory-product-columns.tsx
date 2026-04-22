import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

export type InventoryProductRow = {
   id: string;
   name: string;
   description: string | null;
   baseUnit: string;
   purchaseUnit: string;
   currentStock: string;
   sellingPrice: string | null;
};

function StockBadge({ stock }: { stock: string }) {
   const value = Number(stock);
   const variant =
      value <= 0 ? "destructive" : value <= 5 ? "outline" : "secondary";
   return <Badge variant={variant}>{value <= 0 ? "Sem estoque" : stock}</Badge>;
}

export function buildInventoryProductColumns(): ColumnDef<InventoryProductRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Produto",
         meta: {
            label: "Produto",
            cellComponent: "text" as const,
            editSchema: z
               .string()
               .min(2, "Nome deve ter no mínimo 2 caracteres."),
         },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "description",
         header: "Descrição",
         meta: {
            label: "Descrição",
            cellComponent: "text" as const,
         },
         cell: ({ row }) => {
            const { description } = row.original;
            if (!description)
               return <span className="text-muted-foreground">—</span>;
            return (
               <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                  {description}
               </span>
            );
         },
      },
      {
         accessorKey: "baseUnit",
         header: "Unidade",
         meta: {
            label: "Unidade",
            cellComponent: "text" as const,
            editSchema: z.string().min(1, "Unidade é obrigatória.").max(10),
         },
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {row.original.baseUnit}
            </span>
         ),
      },
      {
         accessorKey: "currentStock",
         header: "Estoque",
         cell: ({ row }) => (
            <div className="flex items-center gap-2">
               <StockBadge stock={row.original.currentStock} />
               <span className="text-muted-foreground text-xs">
                  {row.original.baseUnit}
               </span>
            </div>
         ),
      },
      {
         accessorKey: "sellingPrice",
         header: "Preço de venda",
         cell: ({ row }) => {
            if (!row.original.sellingPrice)
               return <span className="text-muted-foreground">—</span>;
            return (
               <span>
                  R$ {Number(row.original.sellingPrice).toFixed(2)}{" "}
                  <span className="text-muted-foreground text-xs">
                     /{row.original.baseUnit}
                  </span>
               </span>
            );
         },
      },
   ];
}
