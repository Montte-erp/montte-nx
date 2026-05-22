import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { History, PackagePlus } from "lucide-react";

export type ProdutoMovementType = "entrada" | "saida" | "ajuste";

export type ProdutoMovement = {
   id: string;
   type: ProdutoMovementType;
   quantityUnits: number;
   previousQuantityUnits: number;
   resultingQuantityUnits: number;
   unitCost: number;
   totalAmount: number;
   reason: string;
   categoryId: string;
   categoryName: string;
   tagId: string;
   tagName: string;
   occurredAt: string;
   note: string;
   createsFinancialEntry: boolean;
};

export type ProdutoRow = {
   id: string;
   sku: string;
   nome: string;
   saldo: number;
   minimo: number;
   custoUnitario: number;
   precoVenda: number;
   categoryId: string;
   categoryName: string;
   tagId: string;
   tagName: string;
   movements: ProdutoMovement[];
};

export function getProdutoStatus(row: ProdutoRow) {
   if (row.saldo < row.minimo) return "abaixo_minimo";
   if (row.saldo === row.minimo) return "no_minimo";
   return "disponivel";
}

export function ProdutoStatusBadge({ row }: { row: ProdutoRow }) {
   const status = getProdutoStatus(row);
   if (status === "disponivel")
      return <Badge variant="success">Disponível</Badge>;
   if (status === "abaixo_minimo")
      return <Badge variant="destructive">Abaixo do mínimo</Badge>;
   return <Badge variant="secondary">No mínimo</Badge>;
}

export function buildProdutosColumns({
   onRegisterMovement,
   onOpenHistory,
}: {
   onRegisterMovement: (id: string) => void;
   onOpenHistory: (id: string) => void;
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
         accessorKey: "saldo",
         header: "Saldo",
         meta: { label: "Saldo", align: "right", exportable: true },
         cell: ({ row }) => (
            <span className="tabular-nums">{row.original.saldo}</span>
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
         accessorKey: "custoUnitario",
         header: "Custo unitário",
         meta: {
            label: "Custo unitário",
            align: "right",
            exportable: true,
         },
         cell: ({ row }) => (
            <span className="tabular-nums">
               {formatBRL(row.original.custoUnitario)}
            </span>
         ),
      },
      {
         accessorKey: "precoVenda",
         header: "Preço de venda",
         meta: {
            label: "Preço de venda",
            align: "right",
            exportable: true,
         },
         cell: ({ row }) => (
            <span className="tabular-nums">
               {formatBRL(row.original.precoVenda)}
            </span>
         ),
      },
      {
         id: "valorEstoque",
         header: "Valor em estoque",
         meta: {
            label: "Valor em estoque",
            align: "right",
            exportable: true,
            exportValue: (row) => formatBRL(row.saldo * row.custoUnitario),
         },
         cell: ({ row }) => (
            <span className="tabular-nums font-medium">
               {formatBRL(row.original.saldo * row.original.custoUnitario)}
            </span>
         ),
      },
      {
         accessorKey: "categoryName",
         header: "Categoria",
         meta: { label: "Categoria", exportable: true },
         cell: ({ row }) =>
            row.original.categoryName ? (
               row.original.categoryName
            ) : (
               <span className="text-muted-foreground">Sem categoria</span>
            ),
      },
      {
         accessorKey: "tagName",
         header: "Centro de Custo",
         meta: { label: "Centro de Custo", exportable: true },
         cell: ({ row }) =>
            row.original.tagName ? (
               row.original.tagName
            ) : (
               <span className="text-muted-foreground">
                  Sem Centro de Custo
               </span>
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
                  onClick={() => onRegisterMovement(row.original.id)}
                  size="icon-sm"
                  tooltip="Registrar movimentação"
                  variant="outline"
               >
                  <PackagePlus />
               </Button>
               <Button
                  onClick={() => onOpenHistory(row.original.id)}
                  size="icon-sm"
                  tooltip="Ver histórico"
                  variant="outline"
               >
                  <History />
               </Button>
            </div>
         ),
      },
   ];
}

export function formatBRL(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
   }).format(value);
}
