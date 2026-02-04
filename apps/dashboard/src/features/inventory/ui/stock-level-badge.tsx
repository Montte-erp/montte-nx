import { Badge } from "@packages/ui/components/badge";
import { cn } from "@packages/ui/lib/utils";

type StockLevelBadgeProps = {
	quantity: string;
	unit: string;
	reorderPoint?: string | null;
	className?: string;
};

export function StockLevelBadge({
	quantity,
	unit,
	reorderPoint,
	className,
}: StockLevelBadgeProps) {
	const quantityNum = Number.parseFloat(quantity);
	const reorderPointNum = reorderPoint ? Number.parseFloat(reorderPoint) : null;

	const getStockStatus = () => {
		if (quantityNum === 0) {
			return {
				className: "bg-red-500/10 text-red-600 border-red-500/20",
				label: "Sem Estoque",
			};
		}

		if (reorderPointNum !== null) {
			if (quantityNum < reorderPointNum) {
				return {
					className: "bg-red-500/10 text-red-600 border-red-500/20",
					label: "Abaixo do Mínimo",
				};
			}
			if (quantityNum === reorderPointNum) {
				return {
					className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
					label: "No Mínimo",
				};
			}
		}

		return {
			className: "bg-green-500/10 text-green-600 border-green-500/20",
			label: "Em Estoque",
		};
	};

	const status = getStockStatus();

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Badge className={cn(status.className)} variant="outline">
				<span>{status.label}</span>
			</Badge>
			<span className="text-sm text-muted-foreground">
				{quantity} {unit}
			</span>
		</div>
	);
}
