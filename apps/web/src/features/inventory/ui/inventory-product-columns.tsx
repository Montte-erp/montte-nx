import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, History, MoreHorizontal, PackagePlus, Pencil } from "lucide-react";

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
	return (
		<Badge variant={variant}>
			{value <= 0 ? "Sem estoque" : stock}
		</Badge>
	);
}

export function buildInventoryProductColumns(
	onRegisterMovement: (product: InventoryProductRow) => void,
	onViewHistory: (product: InventoryProductRow) => void,
	onEdit: (product: InventoryProductRow) => void,
	onArchive: (product: InventoryProductRow) => void,
): ColumnDef<InventoryProductRow>[] {
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
		{
			id: "actions",
			cell: ({ row }) => (
				<div className="flex items-center gap-1">
					<Button
						onClick={() => onRegisterMovement(row.original)}
						size="sm"
						variant="outline"
					>
						<PackagePlus className="size-3.5 mr-1" />
						Movimento
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="icon-sm" variant="ghost">
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => onViewHistory(row.original)}>
								<History className="size-4 mr-2" />
								Ver histórico
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onEdit(row.original)}>
								<Pencil className="size-4 mr-2" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive"
								onClick={() => onArchive(row.original)}
							>
								<Archive className="size-4 mr-2" />
								Arquivar
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			),
		},
	];
}
