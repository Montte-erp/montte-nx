import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";

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
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
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
