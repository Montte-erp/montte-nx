import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { PackageCheck, PackageMinus, Trash2 } from "lucide-react";

export type ProdutoRow = {
   id: string;
   sku: string;
   nome: string;
   saldo: number;
   reservado: number;
   minimo: number;
   deposito: string;
};

export function getProdutoStatus(row: ProdutoRow) {
   if (row.saldo < row.minimo) return "abaixo_minimo";
   if (row.reservado >= row.saldo && row.saldo > 0) return "reservado";
   return "disponivel";
}

export function ProdutoStatusBadge({ row }: { row: ProdutoRow }) {
   const status = getProdutoStatus(row);
   if (status === "disponivel")
      return <Badge variant="success">Disponível</Badge>;
   if (status === "abaixo_minimo")
      return <Badge variant="destructive">Abaixo do mínimo</Badge>;
   return <Badge variant="secondary">Reservado</Badge>;
}

export function buildProdutosColumns({
   onEntry,
   onReserve,
   onDelete,
}: {
   onEntry: (id: string) => void;
   onReserve: (id: string) => void;
   onDelete: (id: string) => void;
}): ColumnDef<ProdutoRow>[] {
   return [
      {
         accessorKey: "sku",
         header: "SKU",
         meta: { label: "SKU", exportable: true },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.sku}</span>
         ),
      },
      {
         accessorKey: "nome",
         header: "Produto",
         meta: { label: "Produto", filterVariant: "text", exportable: true },
         cell: ({ row }) => (
            <span className="truncate">{row.original.nome}</span>
         ),
      },
      {
         accessorKey: "deposito",
         header: "Depósito",
         meta: { label: "Depósito", exportable: true },
      },
      {
         accessorKey: "saldo",
         header: "Saldo",
         meta: { label: "Saldo", align: "right", exportable: true },
         cell: ({ row }) => (
            <span className="tabular-nums">{row.original.saldo}</span>
         ),
      },
      {
         accessorKey: "reservado",
         header: "Reservado",
         meta: { label: "Reservado", align: "right", exportable: true },
         cell: ({ row }) => (
            <span className="tabular-nums">{row.original.reservado}</span>
         ),
      },
      {
         accessorKey: "minimo",
         header: "Mínimo",
         meta: { label: "Mínimo", align: "right", exportable: true },
         cell: ({ row }) => (
            <span className="tabular-nums">{row.original.minimo}</span>
         ),
      },
      {
         id: "status",
         header: "Status",
         meta: { label: "Status", exportable: true },
         cell: ({ row }) => <ProdutoStatusBadge row={row.original} />,
      },
      {
         id: "__actions",
         size: 120,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right", importIgnore: true },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  onClick={() => onEntry(row.original.id)}
                  size="icon-sm"
                  tooltip="Registrar entrada"
                  variant="outline"
               >
                  <PackageCheck />
               </Button>
               <Button
                  onClick={() => onReserve(row.original.id)}
                  size="icon-sm"
                  tooltip="Reservar item"
                  variant="outline"
               >
                  <PackageMinus />
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original.id)}
                  size="icon-sm"
                  tooltip="Excluir produto"
                  variant="outline"
               >
                  <Trash2 />
               </Button>
            </div>
         ),
      },
   ];
}
