import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@packages/ui/components/card";
import { History, PackagePlus } from "lucide-react";
import type { InventoryProductRow } from "./inventory-product-columns";

interface InventoryProductCardProps {
	product: InventoryProductRow;
	onRegisterMovement: (product: InventoryProductRow) => void;
	onViewHistory: (product: InventoryProductRow) => void;
}

export function InventoryProductCard({
	product,
	onRegisterMovement,
	onViewHistory,
}: InventoryProductCardProps) {
	const stock = Number(product.currentStock);
	const stockColor =
		stock <= 0
			? "bg-destructive"
			: stock <= 5
				? "bg-yellow-400"
				: "bg-emerald-500";

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between gap-2">
					<CardTitle className="text-base">{product.name}</CardTitle>
					{stock <= 0 && (
						<Badge variant="destructive" className="shrink-0">
							Sem estoque
						</Badge>
					)}
					{stock > 0 && stock <= 5 && (
						<Badge variant="outline" className="shrink-0 border-yellow-400 text-yellow-600">
							Estoque baixo
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="space-y-1">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Estoque</span>
						<span className="font-medium">
							{product.currentStock} {product.baseUnit}
						</span>
					</div>
					<div className="h-1.5 rounded-full bg-muted overflow-hidden">
						<div
							className={`h-full rounded-full transition-all ${stockColor}`}
							style={{ width: `${Math.min(100, (stock / 20) * 100)}%` }}
						/>
					</div>
				</div>

				{product.sellingPrice && (
					<p className="text-xs text-muted-foreground">
						Preço: R$ {Number(product.sellingPrice).toFixed(2)}/{product.baseUnit}
					</p>
				)}

				<div className="flex gap-2 pt-1">
					<Button
						className="flex-1"
						onClick={() => onRegisterMovement(product)}
						size="sm"
					>
						<PackagePlus className="size-3.5 mr-1" />
						Movimento
					</Button>
					<Button
						onClick={() => onViewHistory(product)}
						size="icon-sm"
						variant="outline"
					>
						<History className="size-4" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
